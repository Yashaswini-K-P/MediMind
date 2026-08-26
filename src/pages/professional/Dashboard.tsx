import { useEffect, useMemo, useState } from 'react';
import { fetchAssignedPatients, fetchClinicalAlerts, fetchDoseRecords, fetchMedicationSchedules } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type AssignedPatient = { id:string; user_id:string; full_name:string; patient_code:string|null; date_of_birth:string|null; sex:string|null; medical_conditions:string|null };
type Assigned = { patient_id: string; status: string; patient_profiles: AssignedPatient | AssignedPatient[] };

export default function ProfessionalDashboard({ onPatientOpen }: { onPatientOpen: (id:string)=>void }) {
  const { user, professionalProfile } = useAuth();
  const [patients, setPatients] = useState<Array<Assigned & { patient_profiles: AssignedPatient }>>([]);
  const [metrics, setMetrics] = useState<Record<string,{adherence:number; meds:number; events:number; last:string|null}>>({});
  const [loading,setLoading]=useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const rawAssigned = await fetchAssignedPatients(user.id) as Assigned[];
      const assigned = rawAssigned.map(row => ({
        ...row,
        patient_profiles: Array.isArray(row.patient_profiles) ? row.patient_profiles[0] : row.patient_profiles,
      })).filter(row => row.patient_profiles) as Array<Assigned & { patient_profiles: AssignedPatient }>;
      setPatients(assigned);
      const result: Record<string,{adherence:number;meds:number;events:number;last:string|null}> = {};
      await Promise.all(assigned.map(async a => {
        const [doses, meds, alerts] = await Promise.all([
          fetchDoseRecords(a.patient_id), fetchMedicationSchedules(a.patient_id), fetchClinicalAlerts(a.patient_id)
        ]);
        const taken=doses.filter(d=>d.status==='taken'||d.status==='late').length;
        result[a.patient_id] = {
          adherence:doses.length?Math.round(taken/doses.length*100):0,
          meds:meds.length,
          events:alerts.filter(x=>x.status!=='resolved'&&x.status!=='dismissed').length,
          last:doses[doses.length-1]?.scheduled_at || null,
        };
      }));
      setMetrics(result); setLoading(false);
    })();
  },[user]);

  const avg = useMemo(() => {
    if (!patients.length) return 0;
    return Math.round(patients.reduce((s,p)=>s+(metrics[p.patient_id]?.adherence||0),0)/patients.length);
  },[patients,metrics]);
  const meds = patients.reduce((s,p)=>s+(metrics[p.patient_id]?.meds||0),0);
  const events = patients.reduce((s,p)=>s+(metrics[p.patient_id]?.events||0),0);

  if(loading) return <div className="empty">Loading professional dashboard...</div>;

  return <section className="page active">
    <div className="pro-dashboard-shell">
      <div className="pro-dashboard-head">
        <div className="pro-dashboard-brand"><div className="pro-dashboard-icon">+</div><div className="pro-dashboard-title"><h2>Professional Dashboard</h2><p>{professionalProfile?.organization || 'Assigned patient monitoring'} · Evidence-aware clinical review</p></div></div>
        <span className="pro-overview">Assigned patients only</span>
      </div>
      <div className="pro-kpi-grid">
        <Kpi cls="people" label="Patients" value={patients.length} note="Active assignments"/>
        <Kpi cls="adherence" label="Average adherence" value={`${avg}%`} note="From recorded doses"/>
        <Kpi cls="alerts" label="Interaction / alerts" value={events} note="Open clinical alerts"/>
        <Kpi cls="meds" label="Medications tracked" value={meds} note="Active schedules"/>
      </div>
      <div className="card">
        <div className="card-header"><div><h2>Patients</h2><p>Review adherence and open a patient-specific clinical workspace.</p></div><span>{patients.length} assigned</span></div>
        <div className="pro-patient-table-wrap"><table className="table"><thead><tr><th>Patient</th><th>Medications</th><th>Adherence</th><th>Interaction / alerts</th><th>Status</th><th>Last activity</th><th></th></tr></thead>
        <tbody>{patients.map(p=>{const m=metrics[p.patient_id]||{adherence:0,meds:0,events:0,last:null}; return <tr key={p.patient_id}>
          <td><div className="pro-patient"><div className={`pro-avatar ${m.adherence<70?'warn':''}`}>{initials(p.patient_profiles.full_name)}</div><div className="pro-patient-name"><strong>{p.patient_profiles.full_name}</strong><small>{p.patient_profiles.patient_code||p.patient_id.slice(0,8)}</small></div></div></td>
          <td>{m.meds}</td><td><div className="pro-progress-wrap"><div className={`pro-progress ${m.adherence<70?'warn':''}`}><span style={{width:`${m.adherence}%`}}/></div><span className="pro-progress-percent">{m.adherence}%</span></div></td>
          <td><span className={`pro-events ${m.events?'high':'none'}`}>{m.events ? `${m.events} open` : 'None'}</span></td>
          <td><span className={`pro-status ${m.adherence>=90?'excellent':m.events?'review':'good'}`}>{m.events?'Review':m.adherence>=90?'On track':'Monitor'}</span></td>
          <td><span className="pro-updated">{m.last?new Date(m.last).toLocaleDateString():'No dose record'}</span></td>
          <td><button className="pro-action" onClick={()=>onPatientOpen(p.patient_id)} aria-label="Open patient">›</button></td>
        </tr>})}</tbody></table></div>
        {!patients.length && <div className="empty">No active patient assignments were found.</div>}
      </div>
    </div>
  </section>;
}
function Kpi({cls,label,value,note}:{cls:string;label:string;value:string|number;note:string}) {
  return <div className="pro-kpi"><div className={`pro-kpi-icon ${cls}`}>{cls==='people'?'●':cls==='adherence'?'✓':cls==='alerts'?'!':'P'}</div><div><span className="pro-kpi-label">{label}</span><span className="pro-kpi-value">{value}</span><span className="pro-kpi-note">{note}</span></div></div>;
}
function initials(n:string){return n.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
