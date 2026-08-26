/*
# MediMind Core Schema — Part 2 (clinical tables)

Creates the clinical workflow tables that reference Part 1:
drug_food_interactions, interaction_evidence, prescriptions, prescription_lines,
medication_schedules, dose_records, food_intakes, interaction_assessments,
clinical_alerts, safety_reports, safety_reviews.
Also adds the FK from ai_interaction_logs.assessment_id to interaction_assessments.
*/

-- ============================================================
-- DRUG-FOOD INTERACTIONS (validated clinical knowledge)
-- ============================================================
CREATE TABLE IF NOT EXISTS drug_food_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid REFERENCES medications(id) ON DELETE SET NULL,
  normalized_ingredient text NOT NULL,
  food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  food_component_id uuid REFERENCES food_components(id) ON DELETE SET NULL,
  mechanism text NOT NULL,
  effect text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','moderate','high')),
  recommendation text NOT NULL,
  temporal_rule text NOT NULL DEFAULT 'exposure_pattern',
  minimum_interval_hours numeric,
  exposure_rule text,
  population_notes text,
  evidence_level text NOT NULL DEFAULT 'C' CHECK (evidence_level IN ('A','B','C')),
  evidence_type text,
  jurisdiction text NOT NULL DEFAULT 'US',
  knowledge_version_id uuid REFERENCES knowledge_versions(id),
  effective_date date,
  verification_date date,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft','review','approved','deprecated')),
  food_keywords text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE drug_food_interactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_dfi_ingredient ON drug_food_interactions(normalized_ingredient);
CREATE INDEX IF NOT EXISTS idx_dfi_food ON drug_food_interactions(food_id);
CREATE INDEX IF NOT EXISTS idx_dfi_severity ON drug_food_interactions(severity);
CREATE INDEX IF NOT EXISTS idx_dfi_status ON drug_food_interactions(status);

DROP POLICY IF EXISTS "dfi_select" ON drug_food_interactions;
CREATE POLICY "dfi_select" ON drug_food_interactions FOR SELECT TO authenticated USING (true);

-- ============================================================
-- INTERACTION EVIDENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS interaction_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id uuid NOT NULL REFERENCES drug_food_interactions(id) ON DELETE CASCADE,
  source_id uuid REFERENCES knowledge_sources(id),
  source_type text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  source_identifier text,
  title text,
  relevant_section text,
  evidence_type text NOT NULL,
  evidence_level text NOT NULL DEFAULT 'C' CHECK (evidence_level IN ('A','B','C')),
  jurisdiction text NOT NULL DEFAULT 'US',
  publication_date date,
  verification_date date,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  knowledge_version_id uuid REFERENCES knowledge_versions(id),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE interaction_evidence ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_evidence_interaction ON interaction_evidence(interaction_id);

DROP POLICY IF EXISTS "ev_select" ON interaction_evidence;
CREATE POLICY "ev_select" ON interaction_evidence FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  prescriber_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text DEFAULT 'manual',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','historical')),
  prescription_date date NOT NULL DEFAULT CURRENT_DATE,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_rx_status ON prescriptions(status);

DROP POLICY IF EXISTS "rx_select_patient" ON prescriptions;
CREATE POLICY "rx_select_patient" ON prescriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "rx_insert_patient" ON prescriptions;
CREATE POLICY "rx_insert_patient" ON prescriptions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "rx_update_patient" ON prescriptions;
CREATE POLICY "rx_update_patient" ON prescriptions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "rx_select_prof" ON prescriptions;
CREATE POLICY "rx_select_prof" ON prescriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = prescriptions.patient_id AND a.professional_id = auth.uid() AND a.status='active'));
DROP POLICY IF EXISTS "rx_select_admin" ON prescriptions;
CREATE POLICY "rx_select_admin" ON prescriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'));

-- ============================================================
-- PRESCRIPTION LINES
-- ============================================================
CREATE TABLE IF NOT EXISTS prescription_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES medications(id),
  medication_name text NOT NULL,
  dose text NOT NULL,
  dose_unit text,
  frequency text,
  route text,
  instructions text,
  administration_with_food text,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE prescription_lines ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pl_rx ON prescription_lines(prescription_id);

DROP POLICY IF EXISTS "pl_select_patient" ON prescription_lines;
CREATE POLICY "pl_select_patient" ON prescription_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM prescriptions rx
    JOIN patient_profiles pp ON pp.id = rx.patient_id
    WHERE rx.id = prescription_id AND pp.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "pl_select_prof" ON prescription_lines;
CREATE POLICY "pl_select_prof" ON prescription_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM prescriptions rx
    JOIN assignments a ON a.patient_id = rx.patient_id
    WHERE rx.id = prescription_id AND a.professional_id = auth.uid() AND a.status='active'
  ));
DROP POLICY IF EXISTS "pl_insert_patient" ON prescription_lines;
CREATE POLICY "pl_insert_patient" ON prescription_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM prescriptions rx
    JOIN patient_profiles pp ON pp.id = rx.patient_id
    WHERE rx.id = prescription_id AND pp.user_id = auth.uid()
  ));

-- ============================================================
-- MEDICATION SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS medication_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  prescription_id uuid REFERENCES prescriptions(id) ON DELETE SET NULL,
  prescription_line_id uuid REFERENCES prescription_lines(id) ON DELETE SET NULL,
  medication_id uuid REFERENCES medications(id),
  medication_name text NOT NULL,
  dose text NOT NULL,
  dose_unit text,
  scheduled_time text NOT NULL,
  frequency text,
  days_of_week text[] DEFAULT '{}',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  food_instruction text,
  administration_instruction text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ms_patient ON medication_schedules(patient_id) WHERE active=true;
CREATE INDEX IF NOT EXISTS idx_ms_time ON medication_schedules(scheduled_time);

DROP POLICY IF EXISTS "ms_select_patient" ON medication_schedules;
CREATE POLICY "ms_select_patient" ON medication_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ms_insert_patient" ON medication_schedules;
CREATE POLICY "ms_insert_patient" ON medication_schedules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ms_update_patient" ON medication_schedules;
CREATE POLICY "ms_update_patient" ON medication_schedules FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ms_delete_patient" ON medication_schedules;
CREATE POLICY "ms_delete_patient" ON medication_schedules FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ms_select_prof" ON medication_schedules;
CREATE POLICY "ms_select_prof" ON medication_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = medication_schedules.patient_id AND a.professional_id = auth.uid() AND a.status='active'));

-- ============================================================
-- DOSE RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS dose_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES medication_schedules(id) ON DELETE SET NULL,
  medication_name text NOT NULL,
  dose text,
  scheduled_at timestamptz NOT NULL,
  taken_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','taken','missed','late')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dose_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_dr_patient ON dose_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_dr_scheduled ON dose_records(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_dr_status ON dose_records(status);

DROP POLICY IF EXISTS "dr_select_patient" ON dose_records;
CREATE POLICY "dr_select_patient" ON dose_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "dr_insert_patient" ON dose_records;
CREATE POLICY "dr_insert_patient" ON dose_records FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "dr_update_patient" ON dose_records;
CREATE POLICY "dr_update_patient" ON dose_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "dr_select_prof" ON dose_records;
CREATE POLICY "dr_select_prof" ON dose_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = dose_records.patient_id AND a.professional_id = auth.uid() AND a.status='active'));

-- ============================================================
-- FOOD INTAKES
-- ============================================================
CREATE TABLE IF NOT EXISTS food_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id),
  food_name text NOT NULL,
  components text[] DEFAULT '{}',
  amount text,
  amount_unit text,
  meal_period text CHECK (meal_period IN ('Morning','Afternoon','Evening')),
  consumed_at timestamptz NOT NULL DEFAULT now(),
  timezone text DEFAULT 'Asia/Kolkata',
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE food_intakes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fi_patient ON food_intakes(patient_id);
CREATE INDEX IF NOT EXISTS idx_fi_consumed ON food_intakes(consumed_at);

DROP POLICY IF EXISTS "fi_select_patient" ON food_intakes;
CREATE POLICY "fi_select_patient" ON food_intakes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "fi_insert_patient" ON food_intakes;
CREATE POLICY "fi_insert_patient" ON food_intakes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "fi_delete_patient" ON food_intakes;
CREATE POLICY "fi_delete_patient" ON food_intakes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "fi_select_prof" ON food_intakes;
CREATE POLICY "fi_select_prof" ON food_intakes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = food_intakes.patient_id AND a.professional_id = auth.uid() AND a.status='active'));

-- ============================================================
-- INTERACTION ASSESSMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS interaction_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  food_intake_id uuid REFERENCES food_intakes(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES medication_schedules(id) ON DELETE SET NULL,
  interaction_id uuid REFERENCES drug_food_interactions(id) ON DELETE SET NULL,
  food_time timestamptz,
  medication_time text,
  time_difference_hours numeric,
  temporal_relevance text,
  exposure_relevance text,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','moderate','high')),
  recommendation text,
  evidence_snapshot jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE interaction_assessments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ia_patient ON interaction_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_ia_severity ON interaction_assessments(severity);
CREATE INDEX IF NOT EXISTS idx_ia_food ON interaction_assessments(food_intake_id);

-- Allow inserts from service role (edge function) or the patient
DROP POLICY IF EXISTS "ia_select_patient" ON interaction_assessments;
CREATE POLICY "ia_select_patient" ON interaction_assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ia_insert_patient" ON interaction_assessments;
CREATE POLICY "ia_insert_patient" ON interaction_assessments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ia_select_prof" ON interaction_assessments;
CREATE POLICY "ia_select_prof" ON interaction_assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = interaction_assessments.patient_id AND a.professional_id = auth.uid() AND a.status='active'));

-- Now add the FK from ai_interaction_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ai_interaction_logs_assessment_id_fkey'
  ) THEN
    ALTER TABLE ai_interaction_logs
      ADD CONSTRAINT ai_interaction_logs_assessment_id_fkey
      FOREIGN KEY (assessment_id) REFERENCES interaction_assessments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- CLINICAL ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clinical_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES interaction_assessments(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','moderate','high')),
  title text NOT NULL,
  message text NOT NULL,
  recommendation text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','reviewed','resolved','dismissed')),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE clinical_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON clinical_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON clinical_alerts(status);

DROP POLICY IF EXISTS "ca_select_patient" ON clinical_alerts;
CREATE POLICY "ca_select_patient" ON clinical_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ca_update_patient" ON clinical_alerts;
CREATE POLICY "ca_update_patient" ON clinical_alerts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ca_insert_patient" ON clinical_alerts;
CREATE POLICY "ca_insert_patient" ON clinical_alerts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "ca_select_prof" ON clinical_alerts;
CREATE POLICY "ca_select_prof" ON clinical_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = clinical_alerts.patient_id AND a.professional_id = auth.uid() AND a.status='active'));
DROP POLICY IF EXISTS "ca_update_prof" ON clinical_alerts;
CREATE POLICY "ca_update_prof" ON clinical_alerts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = clinical_alerts.patient_id AND a.professional_id = auth.uid() AND a.status='active'))
  WITH CHECK (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = clinical_alerts.patient_id AND a.professional_id = auth.uid() AND a.status='active'));

-- ============================================================
-- SAFETY REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code text UNIQUE,
  patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  symptom text NOT NULL,
  severity text NOT NULL DEFAULT 'Mild' CHECK (severity IN ('Mild','Moderate','Severe')),
  reported_at timestamptz NOT NULL DEFAULT now(),
  medication_exposure text,
  food_exposure text,
  duration text,
  repeated boolean NOT NULL DEFAULT false,
  description text,
  status text NOT NULL DEFAULT 'Needs review' CHECK (status IN ('Needs review','Under review','Closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sr_patient ON safety_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_sr_status ON safety_reports(status);

DROP POLICY IF EXISTS "sr_select_patient" ON safety_reports;
CREATE POLICY "sr_select_patient" ON safety_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "sr_insert_patient" ON safety_reports;
CREATE POLICY "sr_insert_patient" ON safety_reports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "sr_update_patient" ON safety_reports;
CREATE POLICY "sr_update_patient" ON safety_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "sr_select_prof" ON safety_reports;
CREATE POLICY "sr_select_prof" ON safety_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = safety_reports.patient_id AND a.professional_id = auth.uid() AND a.status='active'));
DROP POLICY IF EXISTS "sr_update_prof" ON safety_reports;
CREATE POLICY "sr_update_prof" ON safety_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = safety_reports.patient_id AND a.professional_id = auth.uid() AND a.status='active'))
  WITH CHECK (EXISTS (SELECT 1 FROM assignments a WHERE a.patient_id = safety_reports.patient_id AND a.professional_id = auth.uid() AND a.status='active'));

-- ============================================================
-- SAFETY REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS safety_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_report_id uuid NOT NULL REFERENCES safety_reports(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL,
  clinical_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE safety_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_srev_report ON safety_reviews(safety_report_id);

DROP POLICY IF EXISTS "srev_select" ON safety_reviews;
CREATE POLICY "srev_select" ON safety_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM safety_reports sr
            JOIN patient_profiles pp ON pp.id = sr.patient_id
            WHERE sr.id = safety_report_id AND pp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM safety_reports sr
               JOIN assignments a ON a.patient_id = sr.patient_id
               WHERE sr.id = safety_report_id AND a.professional_id = auth.uid() AND a.status='active')
  );
DROP POLICY IF EXISTS "srev_insert_prof" ON safety_reviews;
CREATE POLICY "srev_insert_prof" ON safety_reviews FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM safety_reports sr
                      JOIN assignments a ON a.patient_id = sr.patient_id
                      WHERE sr.id = safety_report_id AND a.professional_id = auth.uid() AND a.status='active'));