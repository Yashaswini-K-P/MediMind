import { supabase } from '@/lib/supabase';
import type {
  PatientProfile, ProfessionalProfile, MedicationSchedule, DoseRecord,
  FoodIntake, DrugFoodInteraction, SafetyReport, Prescription, PrescriptionLine,
  ClinicalAlert, PatientSettings,
} from '@/types';

export async function fetchPatientProfile(userId: string): Promise<PatientProfile | null> {
  const { data, error } = await supabase
    .from('patient_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.error('fetchPatientProfile:', error.message);
  return data as PatientProfile | null;
}

export async function updatePatientProfile(id: string, updates: Partial<PatientProfile>): Promise<boolean> {
  const { error } = await supabase
    .from('patient_profiles')
    .update(updates)
    .eq('id', id);
  if (error) console.error('updatePatientProfile:', error.message);
  return !error;
}

export async function fetchMedicationSchedules(patientId: string): Promise<MedicationSchedule[]> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*')
    .eq('patient_id', patientId)
    .eq('active', true)
    .order('scheduled_time');
  if (error) console.error('fetchMedicationSchedules:', error.message);
  return (data || []) as MedicationSchedule[];
}

export async function fetchDoseRecords(patientId: string): Promise<DoseRecord[]> {
  const { data, error } = await supabase
    .from('dose_records')
    .select('*')
    .eq('patient_id', patientId)
    .order('scheduled_at', { ascending: true });
  if (error) console.error('fetchDoseRecords:', error.message);
  return (data || []) as DoseRecord[];
}

export async function logDose(patientId: string, scheduleId: string, medName: string, dose: string, scheduledAt: string): Promise<boolean> {
  const start = new Date(scheduledAt);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data: existing, error: lookupError } = await supabase
    .from('dose_records')
    .select('id')
    .eq('patient_id', patientId)
    .eq('schedule_id', scheduleId)
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())
    .limit(1)
    .maybeSingle();
  if (lookupError) console.error('logDose lookup:', lookupError.message);

  const { error } = existing
    ? await supabase.from('dose_records').update({ taken_at: new Date().toISOString(), status: 'taken' }).eq('id', existing.id)
    : await supabase.from('dose_records').insert({
      patient_id: patientId,
      schedule_id: scheduleId,
      medication_name: medName,
      dose,
      scheduled_at: scheduledAt,
      taken_at: new Date().toISOString(),
      status: 'taken',
    });
  if (error) console.error('logDose:', error.message);
  return !error;
}

export async function fetchFoodIntakes(patientId: string): Promise<FoodIntake[]> {
  const { data, error } = await supabase
    .from('food_intakes')
    .select('*')
    .eq('patient_id', patientId)
    .order('consumed_at', { ascending: false });
  if (error) console.error('fetchFoodIntakes:', error.message);
  return (data || []) as FoodIntake[];
}

export async function addFoodIntake(
  patientId: string,
  foodName: string,
  mealPeriod: 'Morning' | 'Afternoon' | 'Evening',
  consumedAt: string,
  components: string[] = [],
): Promise<FoodIntake | null> {
  const { data, error } = await supabase
    .from('food_intakes')
    .insert({
      patient_id: patientId,
      food_name: foodName,
      meal_period: mealPeriod,
      consumed_at: consumedAt,
      components,
    })
    .select()
    .single();
  if (error) console.error('addFoodIntake:', error.message);
  if (data) {
    const assessment = await assessFoodIntake(data.id);
    if (assessment.error) console.error('assessFoodIntake:', assessment.error.message);
  }
  return data as FoodIntake | null;
}

export async function assessFoodIntake(foodIntakeId: string) {
  return supabase.rpc('assess_food_intake', { p_food_intake_id: foodIntakeId });
}

export interface PrescriptionLineInput {
  medication_name: string;
  dose: string;
  dose_unit?: string | null;
  frequency?: string | null;
  instructions?: string | null;
  administration_with_food?: string | null;
}

export async function createPrescription(
  patientId: string,
  source: string,
  notes: string,
  lines: PrescriptionLineInput[],
): Promise<Prescription | null> {
  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .insert({ patient_id: patientId, source, notes: notes || null, status: 'active' })
    .select()
    .single();
  if (error || !prescription) {
    if (error) console.error('createPrescription:', error.message);
    return null;
  }

  if (lines.length) {
    const { error: linesError } = await supabase.from('prescription_lines').insert(
      lines.map(line => ({ prescription_id: prescription.id, ...line })),
    );
    if (linesError) {
      console.error('createPrescription lines:', linesError.message);
      await supabase.from('prescriptions').delete().eq('id', prescription.id);
      return null;
    }
  }
  return prescription as Prescription;
}

export async function addSafetyReview(
  safetyReportId: string,
  professionalId: string,
  status: SafetyReport['status'],
  clinicalNote: string,
): Promise<boolean> {
  const { error: reviewError } = await supabase.from('safety_reviews').insert({
    safety_report_id: safetyReportId,
    professional_id: professionalId,
    status,
    clinical_note: clinicalNote || null,
  });
  if (reviewError) {
    console.error('addSafetyReview:', reviewError.message);
    return false;
  }
  return updateSafetyReport(safetyReportId, { status });
}

export async function fetchInteractions(): Promise<DrugFoodInteraction[]> {
  const { data, error } = await supabase
    .from('drug_food_interactions')
    .select('*')
    .eq('status', 'approved');
  if (error) console.error('fetchInteractions:', error.message);
  return (data || []) as DrugFoodInteraction[];
}

export async function fetchSafetyReports(patientId: string): Promise<SafetyReport[]> {
  const { data, error } = await supabase
    .from('safety_reports')
    .select('*')
    .eq('patient_id', patientId)
    .order('reported_at', { ascending: false });
  if (error) console.error('fetchSafetyReports:', error.message);
  return (data || []) as SafetyReport[];
}

export async function addSafetyReport(
  patientId: string,
  report: Partial<SafetyReport>,
): Promise<SafetyReport | null> {

  const { data, error } = await supabase.rpc(
    'submit_safety_report',
    {
      p_patient_id: patientId,
      p_symptom: report.symptom || '',
      p_severity: report.severity || 'Mild',
      p_reported_at:
        report.reported_at || new Date().toISOString(),
      p_duration: report.duration || null,
      p_repeated: report.repeated ?? false,
      p_description: report.description || null,
      p_medication_exposure:
        report.medication_exposure || null,
      p_food_exposure:
        report.food_exposure || null,
    }
  );

  if (error) {
    console.error('addSafetyReport RPC:', error);
    return null;
  }

  return data as SafetyReport | null;
}

export async function updateSafetyReport(id: string, updates: Partial<SafetyReport>): Promise<boolean> {
  const { error } = await supabase
    .from('safety_reports')
    .update(updates)
    .eq('id', id);
  if (error) console.error('updateSafetyReport:', error.message);
  return !error;
}

export async function fetchPrescriptions(patientId: string): Promise<Prescription[]> {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patientId)
    .order('prescription_date', { ascending: false });
  if (error) console.error('fetchPrescriptions:', error.message);
  return (data || []) as Prescription[];
}

export async function fetchPrescriptionLines(prescriptionId: string): Promise<PrescriptionLine[]> {
  const { data, error } = await supabase
    .from('prescription_lines')
    .select('*')
    .eq('prescription_id', prescriptionId)
    .order('created_at');
  if (error) console.error('fetchPrescriptionLines:', error.message);
  return (data || []) as PrescriptionLine[];
}

export async function fetchPatientSettings(userId: string): Promise<PatientSettings | null> {
  const { data, error } = await supabase
    .from('patient_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.error('fetchPatientSettings:', error.message);
  return data as PatientSettings | null;
}

export async function updatePatientSettings(userId: string, updates: Partial<PatientSettings>): Promise<boolean> {
  const { error } = await supabase
    .from('patient_settings')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });
  if (error) console.error('updatePatientSettings:', error.message);
  return !error;
}

export async function fetchAssignedPatients(professionalId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      patient_id,
      status,
      patient_profiles!inner(
        id, user_id, full_name, patient_code, date_of_birth, sex, medical_conditions
      )
    `)
    .eq('professional_id', professionalId)
    .eq('status', 'active');
  if (error) {
    console.error('fetchAssignedPatients:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchProfessionalProfile(userId: string): Promise<ProfessionalProfile | null> {
  const { data, error } = await supabase
    .from('professional_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.error('fetchProfessionalProfile:', error.message);
  return data as ProfessionalProfile | null;
}


export async function fetchClinicalAlerts(patientId: string): Promise<ClinicalAlert[]> {
  const { data, error } = await supabase
    .from('clinical_alerts')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) console.error('fetchClinicalAlerts:', error.message);
  return (data || []) as ClinicalAlert[];
}

export async function fetchPatientById(patientId: string): Promise<PatientProfile | null> {
  const { data, error } = await supabase.from('patient_profiles').select('*').eq('id', patientId).maybeSingle();
  if (error) console.error('fetchPatientById:', error.message);
  return data as PatientProfile | null;
}
