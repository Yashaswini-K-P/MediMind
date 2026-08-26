export type UserRole = 'patient' | 'professional' | 'admin';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface PatientProfile {
  id: string;
  user_id: string;
  patient_code: string | null;
  full_name: string;
  date_of_birth: string | null;
  sex: string | null;
  blood_group: string | null;
  phone: string | null;
  allergies: string | null;
  drug_allergies: string | null;
  food_allergies: string | null;
  medical_conditions: string | null;
  medical_history: string | null;
  height: number | null;
  weight: number | null;
  emergency_contact: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalProfile {
  id: string;
  user_id: string;
  full_name: string;
  license_number: string | null;
  professional_type: string | null;
  specialty: string | null;
  organization: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  generic_name: string;
  brand_names: string[];
  active_ingredients: string[];
  strength: string | null;
  strength_unit: string | null;
  dosage_form: string | null;
  route: string | null;
  manufacturer: string | null;
  country: string | null;
}

export interface Prescription {
  id: string;
  patient_id: string;
  prescriber_id: string | null;
  source: string;
  status: string;
  prescription_date: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionLine {
  id: string;
  prescription_id: string;
  medication_id: string | null;
  medication_name: string;
  dose: string;
  dose_unit: string | null;
  frequency: string | null;
  route: string | null;
  instructions: string | null;
  administration_with_food: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface MedicationSchedule {
  id: string;
  patient_id: string;
  prescription_id: string | null;
  prescription_line_id: string | null;
  medication_id: string | null;
  medication_name: string;
  dose: string;
  dose_unit: string | null;
  scheduled_time: string;
  frequency: string | null;
  days_of_week: string[];
  start_date: string;
  end_date: string | null;
  food_instruction: string | null;
  administration_instruction: string | null;
  active: boolean;
}

export interface DoseRecord {
  id: string;
  patient_id: string;
  schedule_id: string | null;
  medication_name: string;
  dose: string | null;
  scheduled_at: string;
  taken_at: string | null;
  status: 'scheduled' | 'taken' | 'missed' | 'late';
  notes: string | null;
}

export interface FoodIntake {
  id: string;
  patient_id: string;
  food_id: string | null;
  food_name: string;
  components: string[];
  amount: string | null;
  amount_unit: string | null;
  meal_period: 'Morning' | 'Afternoon' | 'Evening' | null;
  consumed_at: string;
  timezone: string;
  photo_url: string | null;
  notes: string | null;
}

export interface DrugFoodInteraction {
  id: string;
  medication_id: string | null;
  normalized_ingredient: string;
  food_id: string | null;
  food_component_id: string | null;
  mechanism: string;
  effect: string;
  severity: 'low' | 'moderate' | 'high';
  recommendation: string;
  temporal_rule: string;
  minimum_interval_hours: number | null;
  exposure_rule: string | null;
  population_notes: string | null;
  evidence_level: 'A' | 'B' | 'C';
  evidence_type: string | null;
  jurisdiction: string;
  status: string;
  food_keywords: string[];
}

export interface InteractionEvidence {
  id: string;
  interaction_id: string;
  source_type: string;
  source_name: string;
  source_url: string | null;
  title: string | null;
  evidence_type: string;
  evidence_level: 'A' | 'B' | 'C';
  active: boolean;
}

export interface InteractionAssessment {
  id: string;
  patient_id: string;
  food_intake_id: string | null;
  schedule_id: string | null;
  interaction_id: string | null;
  food_time: string | null;
  medication_time: string | null;
  time_difference_hours: number | null;
  temporal_relevance: string | null;
  exposure_relevance: string | null;
  severity: 'low' | 'moderate' | 'high';
  recommendation: string | null;
  evidence_snapshot: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export interface SafetyReport {
  id: string;
  report_code: string | null;
  patient_id: string;
  symptom: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  reported_at: string;
  medication_exposure: string | null;
  food_exposure: string | null;
  duration: string | null;
  repeated: boolean;
  description: string | null;
  status: 'Needs review' | 'Under review' | 'Closed';
  created_at: string;
  updated_at: string;
}

export interface ClinicalAlert {
  id: string;
  patient_id: string;
  assessment_id: string | null;
  severity: 'low' | 'moderate' | 'high';
  title: string;
  message: string;
  recommendation: string | null;
  status: 'new' | 'reviewing' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface PatientSettings {
  id: string;
  user_id: string;
  language: string;
  theme: 'light' | 'dark';
  font_scale: number;
  medication_reminders: boolean;
  reminder_sound: boolean;
  reminder_vibration: boolean;
  food_interaction_alerts: boolean;
}

export interface Assignment {
  id: string;
  patient_id: string;
  professional_id: string;
  status: 'active' | 'inactive';
  assigned_at: string;
}

export interface Food {
  id: string;
  canonical_name: string;
  display_name: string;
  aliases: string[];
  category: string | null;
}
