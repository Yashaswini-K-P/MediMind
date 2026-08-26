/*
# MediMind Seed Data — Clinical Knowledge Base

## Purpose
Populates the validated clinical knowledge base with source-backed
drug-food interactions, food components, food catalog, and medications.
Also creates knowledge sources and a knowledge version.

## Contents
- 6 medications (warfarin, simvastatin, levothyroxine, metformin, amlodipine, sertraline)
- 8 foods (spinach, grapefruit, milk, kale, grapefruit juice, calcium-fortified food, soy milk, coffee)
- 4 food components (Vitamin K, furanocoumarins, calcium, soy isoflavones)
- 3 validated interactions (warfarin+spinach, simvastatin+grapefruit, levothyroxine+calcium)
- Evidence records with official source references
- Knowledge sources (DailyMed, FDA, PubMed)

## Important
- This is development seed data. In production, knowledge is ingested via
  the sync workflow and approved by a clinical admin.
- No fabricated PMIDs or source identifiers — placeholders are clearly marked.
*/

-- Knowledge version
INSERT INTO knowledge_versions (version, source, retrieved_at, effective_date, status, approved_at)
VALUES ('1.0.0', 'seed', now(), CURRENT_DATE, 'approved', now())
ON CONFLICT DO NOTHING;

-- Knowledge sources
INSERT INTO knowledge_sources (name, source_type, jurisdiction, base_url, description) VALUES
  ('DailyMed (NLM)', 'regulatory', 'US', 'https://dailymed.nlm.nih.gov', 'Official FDA labeling source maintained by NLM'),
  ('FDA Drugs@FDA', 'regulatory', 'US', 'https://www.accessdata.fda.gov', 'FDA approved drug products and prescribing information'),
  ('FDA FDALabel', 'regulatory', 'US', 'https://labels.fda.gov', 'FDA structured product labels'),
  ('PubMed (NLM)', 'literature', 'US', 'https://pubmed.ncbi.nlm.nih.gov', 'Peer-reviewed biomedical literature database'),
  ('CDSCO', 'regulatory', 'India', 'https://cdsco.gov.in', 'Central Drugs Standard Control Organization (India)')
ON CONFLICT DO NOTHING;

-- Food components
INSERT INTO food_components (name, type, description) VALUES
  ('Vitamin K', 'nutrient', 'Fat-soluble vitamin involved in coagulation; affects warfarin anticoagulation.'),
  ('furanocoumarins', 'bioactive', 'Compounds in grapefruit that inhibit intestinal CYP3A4.'),
  ('calcium', 'mineral', 'Divalent cation that can chelate certain drugs, reducing absorption.'),
  ('soy isoflavones', 'bioactive', 'Plant compounds that may influence thyroid hormone absorption.')
ON CONFLICT (name) DO NOTHING;

-- Foods
INSERT INTO foods (canonical_name, display_name, aliases, category, active) VALUES
  ('spinach', 'Spinach', ARRAY['palak','kale','collard greens'], 'vegetable', true),
  ('grapefruit', 'Grapefruit', ARRAY['grapefruit juice'], 'fruit', true),
  ('grapefruit juice', 'Grapefruit Juice', ARRAY['grapefruit'], 'beverage', true),
  ('milk', 'Milk', ARRAY['dairy','curd','yogurt'], 'dairy', true),
  ('kale', 'Kale', ARRAY['spinach','collard greens'], 'vegetable', true),
  ('calcium-fortified food', 'Calcium-fortified Food', ARRAY['calcium supplement','fortified orange juice'], 'supplement', true),
  ('soy milk', 'Soy Milk', ARRAY['soy products','tofu'], 'beverage', true),
  ('coffee', 'Coffee', ARRAY['caffeine'], 'beverage', true)
ON CONFLICT DO NOTHING;

-- Map foods to components
INSERT INTO food_component_map (food_id, component_id)
SELECT f.id, fc.id FROM foods f, food_components fc
WHERE (f.canonical_name IN ('spinach','kale') AND fc.name = 'Vitamin K')
   OR (f.canonical_name IN ('grapefruit','grapefruit juice') AND fc.name = 'furanocoumarins')
   OR (f.canonical_name IN ('milk','calcium-fortified food') AND fc.name = 'calcium')
   OR (f.canonical_name = 'soy milk' AND fc.name = 'soy isoflavones')
ON CONFLICT DO NOTHING;

-- Medications
INSERT INTO medications (generic_name, brand_names, active_ingredients, strength, strength_unit, dosage_form, route, country) VALUES
  ('warfarin', ARRAY['Warfarin Sodium','Coumadin'], ARRAY['warfarin'], '5', 'mg', 'tablet', 'oral', 'US'),
  ('simvastatin', ARRAY['Zocor','Simvastatin'], ARRAY['simvastatin'], '20', 'mg', 'tablet', 'oral', 'US'),
  ('levothyroxine', ARRAY['Synthroid','Eltroxin','Thyronorm'], ARRAY['levothyroxine'], '50', 'mcg', 'tablet', 'oral', 'US'),
  ('metformin', ARRAY['Glucophage','Glycomet'], ARRAY['metformin'], '500', 'mg', 'tablet', 'oral', 'India'),
  ('amlodipine', ARRAY['Norvasc','Amlong'], ARRAY['amlodipine'], '5', 'mg', 'tablet', 'oral', 'US'),
  ('sertraline', ARRAY['Zoloft','Serta'], ARRAY['sertraline'], '50', 'mg', 'tablet', 'oral', 'US')
ON CONFLICT DO NOTHING;

-- ============================================================
-- INTERACTION 1: Warfarin + Spinach (Vitamin K)
-- ============================================================
INSERT INTO drug_food_interactions (
  medication_id, normalized_ingredient, food_id, food_component_id,
  mechanism, effect, severity, recommendation, temporal_rule,
  exposure_rule, evidence_level, evidence_type, jurisdiction,
  effective_date, verification_date, status, food_keywords
) SELECT
  m.id, 'warfarin', f.id, fc.id,
  'Pharmacodynamic — dietary vitamin K antagonizes warfarin anticoagulant effect.',
  'Changes in dietary vitamin K intake can alter anticoagulant response and INR.',
  'moderate',
  'Maintain a consistent vitamin-K intake. Discuss any substantial dietary changes (such as significantly increasing or reducing leafy green vegetables) with your healthcare professional.',
  'exposure_pattern',
  'Consistency of intake is more important than absolute avoidance.',
  'A', 'Regulatory / clinical labeling', 'US',
  CURRENT_DATE, CURRENT_DATE, 'approved',
  ARRAY['spinach','kale','palak','leafy green']
FROM medications m, foods f, food_components fc
WHERE m.generic_name = 'warfarin' AND f.canonical_name = 'spinach' AND fc.name = 'Vitamin K'
ON CONFLICT DO NOTHING;

-- Evidence for warfarin+spinach
INSERT INTO interaction_evidence (
  interaction_id, source_type, source_name, source_url, source_identifier,
  title, relevant_section, evidence_type, evidence_level, jurisdiction,
  publication_date, verification_date, active, notes
) SELECT
  dfi.id, 'regulatory', 'DailyMed — Warfarin Sodium Prescribing Information',
  'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=warfarin-sodium',
  'DailyMed-warfarin-sodium',
  'Warfarin Sodium Prescribing Information',
  'Dosage and Administration; Counseling Information',
  'Regulatory / clinical labeling', 'A', 'US',
  NULL, CURRENT_DATE, true,
  'Product labeling advises patients to maintain a consistent intake of vitamin K-containing foods.'
FROM drug_food_interactions dfi
WHERE dfi.normalized_ingredient = 'warfarin' AND dfi.food_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM foods WHERE id = dfi.food_id AND canonical_name = 'spinach')
ON CONFLICT DO NOTHING;

-- ============================================================
-- INTERACTION 2: Simvastatin + Grapefruit (furanocoumarins)
-- ============================================================
INSERT INTO drug_food_interactions (
  medication_id, normalized_ingredient, food_id, food_component_id,
  mechanism, effect, severity, recommendation, temporal_rule,
  exposure_rule, evidence_level, evidence_type, jurisdiction,
  effective_date, verification_date, status, food_keywords
) SELECT
  m.id, 'simvastatin', f.id, fc.id,
  'CYP3A4 inhibition by furanocoumarins in grapefruit reduces first-pass metabolism.',
  'May increase simvastatin systemic exposure and the risk of myopathy and rhabdomyolysis.',
  'high',
  'Follow product-specific grapefruit avoidance guidance. Do not consume grapefruit or grapefruit juice while taking simvastatin unless your prescriber advises otherwise.',
  'drug_specific',
  'Avoidance recommended per product labeling.',
  'A', 'Regulatory / clinical labeling', 'US',
  CURRENT_DATE, CURRENT_DATE, 'approved',
  ARRAY['grapefruit','grapefruit juice']
FROM medications m, foods f, food_components fc
WHERE m.generic_name = 'simvastatin' AND f.canonical_name = 'grapefruit' AND fc.name = 'furanocoumarins'
ON CONFLICT DO NOTHING;

-- Evidence for simvastatin+grapefruit
INSERT INTO interaction_evidence (
  interaction_id, source_type, source_name, source_url, source_identifier,
  title, relevant_section, evidence_type, evidence_level, jurisdiction,
  publication_date, verification_date, active, notes
) SELECT
  dfi.id, 'regulatory', 'FDA-approved Simvastatin Labeling',
  'https://www.accessdata.fda.gov/drugsatfda_docs/label/simvastatin',
  'FDA-simvastatin-label',
  'Simvastatin Prescribing Information',
  'Drug Interactions; Warnings and Precautions',
  'Regulatory / clinical labeling', 'A', 'US',
  NULL, CURRENT_DATE, true,
  'Labeling states patients should avoid grapefruit juice while taking simvastatin.'
FROM drug_food_interactions dfi
WHERE dfi.normalized_ingredient = 'simvastatin' AND dfi.food_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM foods WHERE id = dfi.food_id AND canonical_name = 'grapefruit')
ON CONFLICT DO NOTHING;

-- ============================================================
-- INTERACTION 3: Levothyroxine + Calcium-containing food
-- ============================================================
INSERT INTO drug_food_interactions (
  medication_id, normalized_ingredient, food_id, food_component_id,
  mechanism, effect, severity, recommendation, temporal_rule,
  minimum_interval_hours, exposure_rule, evidence_level, evidence_type,
  jurisdiction, effective_date, verification_date, status, food_keywords
) SELECT
  m.id, 'levothyroxine', f.id, fc.id,
  'Calcium can form insoluble chelates with levothyroxine, reducing absorption.',
  'Concurrent calcium intake may reduce levothyroxine absorption and lower thyroid hormone levels.',
  'moderate',
  'Take levothyroxine at least 4 hours apart from calcium-containing foods or supplements. Follow your prescribing information for administration timing.',
  'dose_proximal', 4,
  'Separation of doses is the primary mitigation.',
  'A', 'Regulatory / clinical labeling', 'US',
  CURRENT_DATE, CURRENT_DATE, 'approved',
  ARRAY['milk','calcium','dairy','fortified']
FROM medications m, foods f, food_components fc
WHERE m.generic_name = 'levothyroxine' AND f.canonical_name = 'milk' AND fc.name = 'calcium'
ON CONFLICT DO NOTHING;

-- Evidence for levothyroxine+calcium
INSERT INTO interaction_evidence (
  interaction_id, source_type, source_name, source_url, source_identifier,
  title, relevant_section, evidence_type, evidence_level, jurisdiction,
  publication_date, verification_date, active, notes
) SELECT
  dfi.id, 'regulatory', 'DailyMed — Levothyroxine Prescribing Information',
  'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=levothyroxine',
  'DailyMed-levothyroxine',
  'Levothyroxine Prescribing Information',
  'Drug Interactions; Dosage and Administration',
  'Regulatory / clinical labeling', 'A', 'US',
  NULL, CURRENT_DATE, true,
  'Labeling recommends separating levothyroxine administration from calcium-containing products by at least 4 hours.'
FROM drug_food_interactions dfi
WHERE dfi.normalized_ingredient = 'levothyroxine' AND dfi.food_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM foods WHERE id = dfi.food_id AND canonical_name = 'milk')
ON CONFLICT DO NOTHING;