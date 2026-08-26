/*
# MediMind Interaction Assessment Function

## Purpose
A SECURITY DEFINER function that assesses a single food intake against a
patient's active medications, creating interaction_assessments and
clinical_alerts when validated matches exist. This enforces the interaction
engine entirely server-side — the frontend cannot fabricate interactions.

## How it works
1. Given p_food_intake_id, fetch the food intake + patient.
2. Resolve the food's components via food_component_map.
3. Fetch the patient's active medication schedules (active=true).
4. For each schedule, look up the medication's active_ingredients.
5. Match against drug_food_interactions by:
   - normalized_ingredient matching any active ingredient, AND
   - food_id matching, OR food_component_id matching a resolved component,
     OR the food name matching any food_keywords entry.
6. Only status='approved' interactions are considered.
7. For each match, compute temporal relevance based on the interaction's
   temporal_rule and the time difference between food intake and the
   scheduled medication time. Exposure relevance is set from the rule.
8. Insert an interaction_assessment with an evidence_snapshot.
9. Insert a clinical_alert if severity is moderate or high.

## Security
- SECURITY DEFINER so it can write to interaction_assessments and
  clinical_alerts, which are normally patient-insert-only. The function
  validates that the caller is the patient who owns the food intake.
- Returns JSON with matched interactions and created assessment/alert IDs.
*/

CREATE OR REPLACE FUNCTION assess_food_intake(p_food_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake food_intakes%ROWTYPE;
  v_patient_id uuid;
  v_caller uuid := auth.uid();
  v_food_components uuid[];
  v_results jsonb := '[]'::jsonb;
  v_match record;
  v_assessment_id uuid;
  v_alert_id uuid;
  v_evidence jsonb;
  v_time_diff numeric;
  v_med_time timestamptz;
  v_temporal text;
  v_exposure text;
  v_is_patient boolean;
BEGIN
  -- Fetch the food intake
  SELECT * INTO v_intake FROM food_intakes WHERE id = p_food_intake_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Food intake not found');
  END IF;

  v_patient_id := v_intake.patient_id;

  -- Verify the caller is the patient who owns this intake
  SELECT EXISTS (
    SELECT 1 FROM patient_profiles pp
    WHERE pp.id = v_patient_id AND pp.user_id = v_caller
  ) INTO v_is_patient;
  IF NOT v_is_patient THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Resolve food components
  SELECT array_agg(component_id) INTO v_food_components
  FROM food_component_map WHERE food_id = v_intake.food_id;

  -- Iterate over active medication schedules and match interactions
  FOR v_match IN
    SELECT
      dfi.id AS interaction_id,
      dfi.medication_id,
      dfi.normalized_ingredient,
      dfi.mechanism,
      dfi.effect,
      dfi.severity,
      dfi.recommendation,
      dfi.temporal_rule,
      dfi.minimum_interval_hours,
      dfi.exposure_rule,
      dfi.evidence_level,
      dfi.evidence_type,
      dfi.food_component_id,
      ms.id AS schedule_id,
      ms.medication_name,
      ms.scheduled_time,
      ms.dose,
      ms.dose_unit
    FROM drug_food_interactions dfi
    JOIN medication_schedules ms ON ms.patient_id = v_patient_id AND ms.active = true
    JOIN medications m ON m.id = ms.medication_id
    WHERE dfi.status = 'approved'
      AND dfi.normalized_ingredient = ANY(m.active_ingredients)
      AND (
        dfi.food_id = v_intake.food_id
        OR (dfi.food_component_id IS NOT NULL AND dfi.food_component_id = ANY(COALESCE(v_food_components, '{}'::uuid[])))
        OR (
          dfi.food_keywords IS NOT NULL AND array_length(dfi.food_keywords, 1) > 0
          AND EXISTS (
            SELECT 1 FROM unnest(dfi.food_keywords) AS kw
            WHERE v_intake.food_name ILIKE '%' || kw || '%'
          )
        )
      )
  LOOP
    -- Compute temporal relevance
    v_med_time := (v_intake.consumed_at)::date || ' ' || v_match.scheduled_time;
    v_time_diff := EXTRACT(EPOCH FROM (v_intake.consumed_at - v_med_time)) / 3600.0;

    IF v_match.temporal_rule = 'dose_proximal' AND v_match.minimum_interval_hours IS NOT NULL THEN
      IF abs(v_time_diff) < v_match.minimum_interval_hours THEN
        v_temporal := 'Within caution window';
      ELSE
        v_temporal := 'Outside caution window';
      END IF;
    ELSIF v_match.temporal_rule = 'drug_specific' THEN
      v_temporal := 'Follow product-specific guidance';
    ELSE
      v_temporal := 'Exposure pattern — consistency matters';
    END IF;

    v_exposure := COALESCE(v_match.exposure_rule, 'Monitor consistency');

    -- Build evidence snapshot
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'source_name', ie.source_name,
      'source_url', ie.source_url,
      'evidence_level', ie.evidence_level,
      'evidence_type', ie.evidence_type,
      'relevant_section', ie.relevant_section,
      'jurisdiction', ie.jurisdiction,
      'verification_date', ie.verification_date
    )), '[]'::jsonb) INTO v_evidence
    FROM interaction_evidence ie
    WHERE ie.interaction_id = v_match.interaction_id AND ie.active = true;

    -- Insert assessment
    INSERT INTO interaction_assessments (
      patient_id, food_intake_id, schedule_id, interaction_id,
      food_time, medication_time, time_difference_hours,
      temporal_relevance, exposure_relevance, severity,
      recommendation, evidence_snapshot, status
    ) VALUES (
      v_patient_id, p_food_intake_id, v_match.schedule_id, v_match.interaction_id,
      v_intake.consumed_at, v_match.scheduled_time, v_time_diff,
      v_temporal, v_exposure, v_match.severity,
      v_match.recommendation, v_evidence, 'active'
    ) RETURNING id INTO v_assessment_id;

    -- Insert alert for moderate/high severity
    IF v_match.severity IN ('moderate','high') THEN
      INSERT INTO clinical_alerts (
        patient_id, assessment_id, severity, title, message, recommendation, status
      ) VALUES (
        v_patient_id, v_assessment_id, v_match.severity,
        v_match.medication_name || ' + ' || v_intake.food_name,
        v_match.effect,
        v_match.recommendation,
        'new'
      ) RETURNING id INTO v_alert_id;
    ELSE
      v_alert_id := NULL;
    END IF;

    v_results := v_results || jsonb_build_object(
      'interaction_id', v_match.interaction_id,
      'assessment_id', v_assessment_id,
      'alert_id', v_alert_id,
      'medication', v_match.medication_name,
      'food', v_intake.food_name,
      'component', v_match.food_component_id,
      'mechanism', v_match.mechanism,
      'effect', v_match.effect,
      'severity', v_match.severity,
      'temporal_relevance', v_temporal,
      'exposure_relevance', v_exposure,
      'recommendation', v_match.recommendation,
      'evidence_level', v_match.evidence_level,
      'evidence', v_evidence
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', v_patient_id,
    'food_intake_id', p_food_intake_id,
    'matched_interactions', v_results,
    'count', jsonb_array_length(v_results)
  );
END;
$$;

-- Grant execute to authenticated users (the function checks ownership internally)
REVOKE ALL ON FUNCTION assess_food_intake(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assess_food_intake(uuid) TO authenticated;