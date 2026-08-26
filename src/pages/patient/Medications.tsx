import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { fetchMedicationSchedules, fetchDoseRecords, logDose } from '@/lib/api';
import type { MedicationSchedule, DoseRecord } from '@/types';

export default function MedicationManagement() {
  const { patientProfile } = useAuth();
  const { show } = useToast();
  const [meds, setMeds] = useState<MedicationSchedule[]>([]);
  const [doses, setDoses] = useState<DoseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientProfile) return;
    const [m, d] = await Promise.all([
      fetchMedicationSchedules(patientProfile.id),
      fetchDoseRecords(patientProfile.id),
    ]);
    setMeds(m);
    setDoses(d);
    setLoading(false);
  }, [patientProfile]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty">Loading medications...</div>;

  const handleLogDose = async (med: MedicationSchedule) => {
    if (!patientProfile) return;
    const today = new Date();
    const [hours, minutes] = med.scheduled_time.split(':').map(Number);
    today.setHours(hours || 0, minutes || 0, 0, 0);
    const ok = await logDose(patientProfile.id, med.id, med.medication_name, `${med.dose} ${med.dose_unit || ''}`.trim(), today.toISOString());
    show(ok ? 'Dose recorded' : 'Failed to record dose');
    if (ok) load();
  };

  const getMedDoses = (medId: string) => doses.filter(d => d.schedule_id === medId);
  const getAdherence = (medId: string) => {
    const medDoses = getMedDoses(medId);
    if (!medDoses.length) return 0;
    const taken = medDoses.filter(d => d.status === 'taken' || d.status === 'late').length;
    return Math.round((taken / medDoses.length) * 100);
  };

  return (
    <section className="page active">
      <div className="card">
        <div className="card-header"><h2>Medication Management</h2><span>{meds.length} active</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Medicine</th><th>Dose</th><th>Time</th><th>Frequency</th><th>Food guidance</th><th>Adherence</th><th>Status</th></tr></thead>
            <tbody>
              {meds.map(m => {
                const adherence = getAdherence(m.id);
                return (
                  <tr key={m.id}>
                    <td><strong>{m.medication_name}</strong></td>
                    <td>{m.dose} {m.dose_unit}</td>
                    <td>{m.scheduled_time}</td>
                    <td>{m.frequency}</td>
                    <td>{m.food_instruction}<div className="administration-tip">{m.administration_instruction}</div></td>
                    <td>
                      <div className="adherence-meter">
                        <span className="adherence-bar"><span className="adherence-fill" style={{ width: `${adherence}%` }} /></span>
                        <span className="adherence-percent">{adherence}%</span>
                      </div>
                    </td>
                    <td><button className="secondary-btn" onClick={() => handleLogDose(m)}>Mark dose taken</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Medication Schedule</h2><span>Today</span></div>
        {meds.map(m => {
          const medDoses = getMedDoses(m.id);
          const takenCount = medDoses.filter(d => d.status === 'taken' || d.status === 'late').length;
          return (
            <div className="medication" key={m.id}>
              <div style={{ flex: 1 }}>
                <strong>{m.medication_name} {m.dose} {m.dose_unit}</strong>
                <small>{m.scheduled_time} - {m.food_instruction} - {takenCount}/{medDoses.length} doses recorded</small>
                <div className="administration-tip">{m.administration_instruction}</div>
              </div>
              <button className="secondary-btn" onClick={() => handleLogDose(m)}>Log dose</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
