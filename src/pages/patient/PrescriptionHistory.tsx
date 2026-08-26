import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createPrescription, fetchPrescriptionLines, fetchPrescriptions } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import type { Prescription, PrescriptionLine } from '@/types';

export default function PrescriptionHistory() {
  const { patientProfile } = useAuth();
  const [items, setItems] = useState<Array<{ prescription: Prescription; lines: PrescriptionLine[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const { show } = useToast();

  useEffect(() => {
    if (!patientProfile) return;
    (async () => {
      const ps = await fetchPrescriptions(patientProfile.id);
      const rows = await Promise.all(ps.map(async p => ({ prescription: p, lines: await fetchPrescriptionLines(p.id) })));
      setItems(rows); setLoading(false);
    })();
  }, [patientProfile]);

  const saveManualPrescription = async () => {
    if (!patientProfile || !manualText.trim()) { show('Enter at least one medication line.'); return; }
    const lines = manualText.split('\n').map(line => line.trim()).filter(Boolean).flatMap(line => {
      const dose = line.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?)/i);
      if (!dose || dose.index === undefined) return [];
      const medicationName = line.slice(0, dose.index).trim();
      if (!medicationName) return [];
      return [{
        medication_name: medicationName,
        dose: dose[1],
        dose_unit: dose[2],
        frequency: line.slice(dose.index + dose[0].length).trim() || 'As prescribed',
        instructions: null,
        administration_with_food: null,
      }];
    });
    if (!lines.length) { show('Use lines such as: Metformin 500 mg twice daily'); return; }
    const saved = await createPrescription(patientProfile.id, 'manual', manualText.trim(), lines);
    if (!saved) { show('Unable to save prescription.'); return; }
    show('Prescription saved');
    setManualText(''); setManualOpen(false);
    const prescriptions = await fetchPrescriptions(patientProfile.id);
    setItems(await Promise.all(prescriptions.map(async prescription => ({ prescription, lines: await fetchPrescriptionLines(prescription.id) }))));
  };

  if (loading) return <div className="empty">Loading prescription history...</div>;

  return <section className="page active">
    <div className="card">
      <div className="card-header"><div><h2>Prescription History</h2><p>Prescription records linked to your medication regimen.</p></div><button className="primary-btn" style={{width:'auto'}} onClick={() => setManualOpen(value => !value)}>Enter prescription</button></div>
      {manualOpen && <div className="card" style={{background:'var(--bg)'}}>
        <div className="field"><label>Prescription details</label><textarea rows={5} value={manualText} onChange={e => setManualText(e.target.value)} placeholder={'Metformin 500 mg twice daily\nAmlodipine 5 mg once daily'} /></div>
        <div style={{display:'flex',gap:10}}><button className="primary-btn" style={{width:'auto'}} onClick={saveManualPrescription}>Save prescription</button><button className="secondary-btn" onClick={() => setManualOpen(false)}>Cancel</button></div>
      </div>}
      {!items.length ? <div className="empty">No prescription history is available yet.</div> : items.map(({ prescription, lines }) => (
        <div className="prescription-card" key={prescription.id}>
          <div className="card-header">
            <div><strong>{new Date(prescription.prescription_date).toLocaleDateString()}</strong><p>{prescription.source} · {prescription.status}</p></div>
            <span className="badge neutral">{prescription.start_date || 'Start date not recorded'}</span>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Route</th><th>Instructions</th></tr></thead>
            <tbody>{lines.map(line => <tr key={line.id}><td><strong>{line.medication_name}</strong></td><td>{line.dose} {line.dose_unit || ''}</td><td>{line.frequency || '—'}</td><td>{line.route || '—'}</td><td>{line.instructions || line.administration_with_food || '—'}</td></tr>)}</tbody>
          </table></div>
          {prescription.notes && <div className="calendar-detail"><strong>Notes:</strong> {prescription.notes}</div>}
        </div>
      ))}
    </div>
  </section>;
}
