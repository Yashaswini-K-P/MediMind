import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { fetchMedicationSchedules, updatePatientProfile } from '@/lib/api';
import type { PatientProfile, MedicationSchedule } from '@/types';

export default function PatientProfilePage() {
  const { patientProfile } = useAuth();
  const { show } = useToast();
  const [form, setForm] = useState<PatientProfile | null>(patientProfile);
  const [activeMeds, setActiveMeds] = useState<MedicationSchedule[]>([]);

  useEffect(() => { setForm(patientProfile); if (patientProfile) fetchMedicationSchedules(patientProfile.id).then(setActiveMeds); }, [patientProfile]);

  if (!form) return <div className="empty">Loading profile...</div>;

  const allergyText = form.allergies || 'None recorded';
  const hasAllergy = !['none recorded', 'none'].includes(allergyText.toLowerCase());
  const conditions = (form.medical_conditions || '').split(';').map(c => c.trim()).filter(Boolean);

  const save = async () => {
    const ok = await updatePatientProfile(form.id, {
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      sex: form.sex,
      allergies: form.allergies,
      drug_allergies: form.drug_allergies,
      food_allergies: form.food_allergies,
      medical_conditions: form.medical_conditions,
      medical_history: form.medical_history,
      phone: form.phone,
      emergency_contact: form.emergency_contact,
      height: form.height,
      weight: form.weight,
    });
    show(ok ? 'Patient profile saved' : 'Failed to save profile');
  };

  return (
    <section className="page active">
      <div className="patient-profile-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Demographics</h2>
              <p>Personal information and medical identity</p>
            </div>
            <span>Patient profile</span>
          </div>
          <div className="form-grid">
            <div className="field"><label>Name</label><input value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="field"><label>Age / DOB</label><input type="date" value={form.date_of_birth || ''} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div className="field"><label>Sex</label><input value={form.sex || ''} onChange={e => setForm({ ...form, sex: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field"><label>Allergies</label><input value={form.allergies || ''} onChange={e => setForm({ ...form, allergies: e.target.value })} /></div>
            <div className="field"><label>Emergency Contact</label><input value={form.emergency_contact || ''} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} /></div>
            <div className="field full"><label>Diagnoses / Medical Conditions</label><textarea rows={3} value={form.medical_conditions || ''} onChange={e => setForm({ ...form, medical_conditions: e.target.value })} /></div>
            <div className="field full"><label>Medical History</label><textarea rows={3} value={form.medical_history || ''} onChange={e => setForm({ ...form, medical_history: e.target.value })} /></div>
          </div>
          <button className="primary-btn" style={{ width: 'auto' }} onClick={save}>Save Profile</button>
        </div>

        <div className="card patient-data-panel">
          <div className="card-header">
            <div><h2>Patient Data</h2><p>Personalized health snapshot</p></div>
            <span>Live summary</span>
          </div>
          <div className="patient-data-summary">
            <div className="patient-data-tile">
              <div className="patient-data-tile-head"><span className="patient-data-icon">Pill</span><span className="patient-data-status">Active</span></div>
              <div className="patient-data-label">Current Medications</div>
              <div className="patient-data-value">{activeMeds.length}</div>
              <div className="patient-data-sub">Unique medicines in regimen</div>
            </div>
            <div className="patient-data-tile">
              <div className="patient-data-tile-head"><span className="patient-data-icon">Alert</span><span className={`patient-data-status ${hasAllergy ? 'warn' : ''}`}>{hasAllergy ? 'Review' : 'Clear'}</span></div>
              <div className="patient-data-label">Drug Allergies</div>
              <div className="patient-data-value" style={{ fontSize: 14 }}>{hasAllergy ? 'Recorded' : 'None recorded'}</div>
              <div className="patient-data-sub">{hasAllergy ? allergyText : 'No allergy recorded'}</div>
            </div>
          </div>
          <div className="patient-data-section">
            <div className="patient-data-section-head"><strong>Medical Conditions</strong></div>
            <div className="patient-data-list">
              {conditions.map((c, i) => (
                <div className="patient-data-list-row" key={i}>
                  <div><strong>{c}</strong><small>Recorded medical condition</small></div>
                  <span className="patient-data-status">Recorded</span>
                </div>
              ))}
            </div>
          </div>
          <div className="patient-data-alert">
            <span>Shield</span>
            <div><b>Personalized medication context</b>This summary brings together medication, condition, food and safety information used across MediMind.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
