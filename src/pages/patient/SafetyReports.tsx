import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { addSafetyReport, fetchSafetyReports } from '@/lib/api';
import type { SafetyReport } from '@/types';

export default function SafetyReports() {
  const { patientProfile } = useAuth();
  const { show } = useToast();
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [open, setOpen] = useState(false);
  const [symptom, setSymptom] = useState('');
  const [severity, setSeverity] = useState<SafetyReport['severity']>('Mild');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    if (patientProfile) setReports(await fetchSafetyReports(patientProfile.id));
  }, [patientProfile]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!patientProfile || !symptom.trim()) { show('Please describe how you feel.'); return; }
    const row = await addSafetyReport(patientProfile.id, {
      symptom: symptom.trim(), severity, reported_at: new Date().toISOString(),
      duration: duration || null, repeated: false, description: description || null,
      status: 'Needs review',
    });
    if (row) { show('Your report was recorded for review.'); setSymptom(''); setDuration(''); setDescription(''); setSeverity('Mild'); setOpen(false); void load(); }
    else show('Unable to record the report.');
  };

  return <section className="page active">
    <div className="ss-simple">
      <div className="card">
        <div className="ss-simple-head">
          <div className="ss-simple-title"><div className="ss-simple-icon">♥</div><div><h2>How You Feel</h2><p>Tell your care team about a new symptom or concern.</p></div></div>
          <button className="primary-btn ss-report-btn" onClick={() => setOpen(true)}>Report how you feel</button>
        </div>
        <div className="ss-quick">
          <div className="ss-quick-item"><span>✓</span><div><b>{reports.length}</b><small>Reports recorded</small></div></div>
          <div className="ss-quick-item"><span>↗</span><div><b>{reports.filter(r => r.status !== 'Closed').length}</b><small>Open for review</small></div></div>
          <div className="ss-quick-note"><span>i</span><div>A symptom report is patient-reported information. It is not automatically a confirmed adverse drug reaction.</div></div>
        </div>
        {open && <form className="card" onSubmit={submit}>
          <div className="card-header"><div><h2>New report</h2><p>Keep it simple. Your healthcare professional can review the details.</p></div></div>
          <div className="form-grid">
            <div className="field full"><label>What are you feeling?</label><input autoFocus value={symptom} onChange={e => setSymptom(e.target.value)} placeholder="e.g. dizziness, nausea, headache" /></div>
            <div className="field"><label>How severe is it?</label><select value={severity} onChange={e => setSeverity(e.target.value as SafetyReport['severity'])}><option>Mild</option><option>Moderate</option><option>Severe</option></select></div>
            <div className="field"><label>How long?</label><input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 2 hours" /></div>
            <div className="field full"><label>Anything else to tell your care team?</label><textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional context" /></div>
          </div>
          <div style={{display:'flex',gap:10}}><button className="primary-btn" style={{width:'auto'}} type="submit">Submit report</button><button className="secondary-btn" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>}
      </div>

      <div className="card">
        <div className="ss-section-head"><h3>Recent reports</h3><span>{reports.length} total</span></div>
        {!reports.length ? <div className="ss-empty"><span>✓</span><div><b>No reports yet</b><p>If something feels different, you can record it here for your healthcare professional.</p></div></div> :
          reports.map(r => <div className="ss-report-row" key={r.id}><div className="ss-report-symbol">{r.severity === 'Severe' ? '!' : '•'}</div><div className="ss-report-main"><b>{r.symptom}</b><small>{new Date(r.reported_at).toLocaleString()} · {r.severity} · {r.status}</small>{r.description && <small>{r.description}</small>}</div><span className={`badge ${r.severity === 'Severe' ? 'high' : r.severity === 'Moderate' ? 'moderate' : 'low'}`}>{r.status}</span></div>)
        }
      </div>
      <div className="ss-help"><span>i</span><div><b>When to seek urgent care</b><br/>If you have severe or rapidly worsening symptoms, use appropriate urgent/emergency medical services rather than relying on this report.</div></div>
    </div>
  </section>;
}
