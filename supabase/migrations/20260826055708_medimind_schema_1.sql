/*
# MediMind Core Schema — Part 1 (structural tables)

Creates the foundational tables that other tables reference:
profiles, patient_profiles, professional_profiles, assignments,
medications, foods, food_components, food_component_map,
knowledge_sources, knowledge_versions, patient_settings, audit_logs, ai_interaction_logs.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (role + identity)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'patient' CHECK (role IN ('patient','professional','admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- PATIENT PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_code text UNIQUE,
  full_name text NOT NULL,
  date_of_birth date,
  sex text,
  blood_group text,
  phone text,
  allergies text,
  drug_allergies text,
  food_allergies text,
  medical_conditions text,
  medical_history text,
  height numeric,
  weight numeric,
  emergency_contact text,
  timezone text DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user ON patient_profiles(user_id);

DROP POLICY IF EXISTS "pp_select_own" ON patient_profiles;
CREATE POLICY "pp_select_own" ON patient_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "pp_insert_own" ON patient_profiles;
CREATE POLICY "pp_insert_own" ON patient_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "pp_update_own" ON patient_profiles;
CREATE POLICY "pp_update_own" ON patient_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "pp_select_admin" ON patient_profiles;
CREATE POLICY "pp_select_admin" ON patient_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- PROFESSIONAL PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS professional_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  license_number text,
  professional_type text,
  specialty text,
  organization text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE professional_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_prof_profiles_user ON professional_profiles(user_id);

DROP POLICY IF EXISTS "prof_select_own" ON professional_profiles;
CREATE POLICY "prof_select_own" ON professional_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "prof_insert_own" ON professional_profiles;
CREATE POLICY "prof_insert_own" ON professional_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "prof_update_own" ON professional_profiles;
CREATE POLICY "prof_update_own" ON professional_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ASSIGNMENTS (patient↔professional)
-- ============================================================
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id, professional_id)
);
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_assignments_prof ON assignments(professional_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_assignments_patient ON assignments(patient_id) WHERE status='active';

DROP POLICY IF EXISTS "asgn_select_prof" ON assignments;
CREATE POLICY "asgn_select_prof" ON assignments FOR SELECT TO authenticated
  USING (professional_id = auth.uid()
         OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'));
DROP POLICY IF EXISTS "asgn_select_patient" ON assignments;
CREATE POLICY "asgn_select_patient" ON assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.id = patient_id AND pp.user_id = auth.uid()));
DROP POLICY IF EXISTS "asgn_insert_prof" ON assignments;
CREATE POLICY "asgn_insert_prof" ON assignments FOR INSERT TO authenticated
  WITH CHECK (professional_id = auth.uid()
              OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'));
DROP POLICY IF EXISTS "asgn_update_prof" ON assignments;
CREATE POLICY "asgn_update_prof" ON assignments FOR UPDATE TO authenticated
  USING (professional_id = auth.uid()
         OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'))
  WITH CHECK (professional_id = auth.uid()
              OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role='admin'));

-- Now add the professional-reads-assigned policy on patient_profiles
DROP POLICY IF EXISTS "pp_select_assigned" ON patient_profiles;
CREATE POLICY "pp_select_assigned" ON patient_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('professional','admin'))
    AND EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.patient_id = patient_profiles.id
        AND a.professional_id = auth.uid()
        AND a.status = 'active'
    )
  );

-- ============================================================
-- MEDICATIONS (catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name text NOT NULL,
  brand_names text[] DEFAULT '{}',
  active_ingredients text[] DEFAULT '{}',
  strength text,
  strength_unit text,
  dosage_form text,
  route text,
  manufacturer text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meds_generic ON medications(generic_name);
CREATE INDEX IF NOT EXISTS idx_meds_ingredients ON medications USING gin(active_ingredients);

DROP POLICY IF EXISTS "med_select" ON medications;
CREATE POLICY "med_select" ON medications FOR SELECT TO authenticated USING (true);

-- ============================================================
-- FOODS (catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  display_name text NOT NULL,
  aliases text[] DEFAULT '{}',
  category text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_foods_canonical ON foods(canonical_name);
CREATE INDEX IF NOT EXISTS idx_foods_aliases ON foods USING gin(aliases);

DROP POLICY IF EXISTS "food_select" ON foods;
CREATE POLICY "food_select" ON foods FOR SELECT TO authenticated USING (true);

-- ============================================================
-- FOOD COMPONENTS (catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS food_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text,
  description text,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE food_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fc_select" ON food_components;
CREATE POLICY "fc_select" ON food_components FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS food_component_map (
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES food_components(id) ON DELETE CASCADE,
  PRIMARY KEY (food_id, component_id)
);
ALTER TABLE food_component_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fcm_select" ON food_component_map;
CREATE POLICY "fcm_select" ON food_component_map FOR SELECT TO authenticated USING (true);

-- ============================================================
-- KNOWLEDGE SOURCES & VERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'US',
  base_url text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ks_select" ON knowledge_sources;
CREATE POLICY "ks_select" ON knowledge_sources FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  source text,
  retrieved_at timestamptz,
  effective_date date,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','deprecated')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE knowledge_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kv_select" ON knowledge_versions;
CREATE POLICY "kv_select" ON knowledge_versions FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PATIENT SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
  font_scale integer NOT NULL DEFAULT 100 CHECK (font_scale >= 100 AND font_scale <= 140),
  medication_reminders boolean NOT NULL DEFAULT true,
  reminder_sound boolean NOT NULL DEFAULT true,
  reminder_vibration boolean NOT NULL DEFAULT true,
  food_interaction_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patient_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ps_select" ON patient_settings;
CREATE POLICY "ps_select" ON patient_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ps_insert" ON patient_settings;
CREATE POLICY "ps_insert" ON patient_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ps_update" ON patient_settings;
CREATE POLICY "ps_update" ON patient_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

DROP POLICY IF EXISTS "audit_select_own" ON audit_logs;
CREATE POLICY "audit_select_own" ON audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "audit_insert_own" ON audit_logs;
CREATE POLICY "audit_insert_own" ON audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AI INTERACTION LOGS (assessment_id FK added in Part 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_interaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patient_profiles(id) ON DELETE SET NULL,
  assessment_id uuid,
  model text,
  prompt_version text,
  knowledge_version text,
  question text NOT NULL,
  response text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_interaction_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_interaction_logs(user_id);

DROP POLICY IF EXISTS "ai_select_own" ON ai_interaction_logs;
CREATE POLICY "ai_select_own" ON ai_interaction_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_insert_own" ON ai_interaction_logs;
CREATE POLICY "ai_insert_own" ON ai_interaction_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);