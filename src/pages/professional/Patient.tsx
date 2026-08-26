import { useEffect, useMemo, useState } from 'react';
import { addSafetyReview, fetchDoseRecords, fetchFoodIntakes, fetchInteractions, fetchPatientById, fetchSafetyReports, fetchMedicationSchedules } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { analyzeTimedFood, formatTime } from '@/lib/interactions';
import type { DoseRecord, FoodIntake, DrugFoodInteraction, MedicationSchedule, PatientProfile, SafetyReport } from '@/types';

type CalendarCell = { key: string; day: number; other: boolean; today: boolean; doses: DoseRecord[] };

export default function ProfessionalPatient({ patientId, onBack }:{patientId:string;onBack:()=>void}) {
  const { user } = useAuth();
  const [patient,setPatient]=useState<PatientProfile|null>(null);
  const [meds,setMeds]=useState<MedicationSchedule[]>([]);
  const [doses,setDoses]=useState<DoseRecord[]>([]);
  const [foods,setFoods]=useState<FoodIntake[]>([]);
  const [rules,setRules]=useState<DrugFoodInteraction[]>([]);
  const [safety,setSafety]=useState<SafetyReport[]>([]);
  const [reviewId,setReviewId]=useState<string|null>(null);
  const [reviewStatus,setReviewStatus]=useState<SafetyReport['status']>('Under review');
  const [reviewNote,setReviewNote]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ if(!user) return; (async()=>{const [p,m,d,f,r,s]=await Promise.all([fetchPatientById(patientId),fetchMedicationSchedules(patientId),fetchDoseRecords(patientId),fetchFoodIntakes(patientId),fetchInteractions(),fetchSafetyReports(patientId)]);setPatient(p);setMeds(m);setDoses(d);setFoods(f);setRules(r);setSafety(s);setLoading(false);})();},[user,patientId]);

  const adherence=useMemo(()=>{const t=doses.filter(d=>d.status==='taken'||d.status==='late').length;return doses.length?Math.round(t/doses.length*100):0},[doses]);
  const interactions=useMemo(()=>foods.flatMap(f=>{const a=analyzeTimedFood(f.food_name,formatTime(f.consumed_at),meds,rules);return a.matched.map(x=>({food:f,match:x,assessment:a}))}),[foods,meds,rules]);
  const month=useMemo(()=>buildMonth(doses),[doses]);

  const saveReview = async () => {
    if (!reviewId || !user) return;
    const ok = await addSafetyReview(reviewId, user.id, reviewStatus, reviewNote);
    if (ok) {
      setSafety(current => current.map(report => report.id === reviewId ? { ...report, status: reviewStatus } : report));
      setReviewId(null); setReviewNote('');
    }
  };

  if(loading) return <div className="empty">Loading patient clinical record...</div>;
  if(!patient) return <div className="empty">This patient could not be loaded or is no longer assigned to you.</div>;

  return <section className="page active">
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><button className="secondary-btn" onClick={onBack}>← Back to patients</button><span className="badge neutral">Assigned patient</span></div>
      <div className="pg-patient-strip" style={{marginTop:18}}>
        <div><span>Patient</span><strong>{patient.full_name}</strong></div><div><span>Patient code</span><strong>{patient.patient_code||'—'}</strong></div><div><span>Adherence</span><strong>{adherence}%</strong></div><div><span>Open safety reports</span><strong>{safety.filter(s=>s.status!=='Closed').length}</strong></div>
      </div>
    </div>
    <div className="section-grid">
      <div className="card"><div className="card-header"><h2>Demographics & Patient Data</h2><span>Clinical context</span></div>
        <div className="form-grid"><Info label="Date of birth" value={patient.date_of_birth||'Not recorded'}/><Info label="Sex" value={patient.sex||'Not recorded'}/><Info label="Blood group" value={patient.blood_group||'Not recorded'}/><Info label="Phone" value={patient.phone||'Not recorded'}/><Info label="Drug allergies" value={patient.drug_allergies||patient.allergies||'None recorded'}/><Info label="Food allergies" value={patient.food_allergies||'None recorded'}/><Info label="Conditions" value={patient.medical_conditions||'Not recorded'}/><Info label="Medical history" value={patient.medical_history||'Not recorded'}/></div>
      </div>
      <div className="card"><div className="card-header"><h2>Current Medications</h2><span>{meds.length} active</span></div>{meds.map(m=><div className="medication" key={m.id}><div style={{flex:1}}><strong>{m.medication_name} {m.dose} {m.dose_unit||''}</strong><small>{m.scheduled_time} · {m.frequency||'scheduled'} · {m.food_instruction||'No food instruction recorded'}</small><div className="administration-tip">{m.administration_instruction||'Follow the prescription and product information.'}</div></div></div>)}</div>
    </div>

    <div className="card">
      <div className="card-header"><div><h2>Dosing Calendar</h2><p>Recorded doses shown as taken, missed, late or scheduled.</p></div><span>{month.label}</span></div>
      <div className="calendar-scroll"><div className="calendar-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div className="calendar-day-name" key={d}>{d}</div>)}{month.cells.map(c=><div className={`calendar-cell ${c.other?'other-month':''} ${c.today?'today':''}`} key={c.key}><div className="calendar-date">{c.day}</div>{c.doses.map(d=><div className={`calendar-dose ${d.status}`} key={d.id}><span className="dose-dot"/><div><strong>{d.medication_name}</strong><small>{new Date(d.scheduled_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div></div>)}</div>)}</div></div>
      <div className="calendar-legend"><span>● Taken</span><span>● Missed</span><span>● Late</span><span>● Scheduled</span></div>
    </div>

    <div className="card"><div className="card-header"><h2>Individual Medication Adherence</h2><span>Per schedule</span></div><div className="table-wrap"><table><thead><tr><th>Drug</th><th>Doses recorded</th><th>Taken / late</th><th>Adherence</th></tr></thead><tbody>{meds.map(m=>{const md=doses.filter(d=>d.schedule_id===m.id);const taken=md.filter(d=>d.status==='taken'||d.status==='late').length;const pct=md.length?Math.round(taken/md.length*100):0;return <tr key={m.id}><td><strong>{m.medication_name}</strong><small style={{display:'block',color:'var(--text-muted)'}}>{m.dose} {m.dose_unit||''} · {m.scheduled_time}</small></td><td>{md.length}</td><td>{taken}</td><td><div className="pro-progress-wrap"><div className={`pro-progress ${pct<70?'warn':''}`}><span style={{width:`${pct}%`}}/></div><span className="pro-progress-percent">{pct}%</span></div></td></tr>})}</tbody></table></div></div>

    <div className="timeline-severity-grid">
      <div className="card"><div className="card-header"><h2>Drug-Food Interaction Review</h2><span>{interactions.length} matched event(s)</span></div>{interactions.length?interactions.map((x,i)=><div className={`interaction-timeline-item ${x.match.rule.severity}`} key={i}><div className="interaction-time-column"><strong>{formatTime(x.food.consumed_at)}</strong><small>{new Date(x.food.consumed_at).toLocaleDateString()}</small></div><div className="interaction-link-column"><div className="interaction-node food-node">F</div><div className="interaction-connector"/><div className="interaction-node drug-node">D</div></div><div><div className="interaction-pair"><strong>{x.food.food_name}</strong><span>+</span><strong>{x.match.med.medication_name}</strong></div><div className="interaction-meta">{x.match.rule.mechanism}</div><div className="interaction-grid-details"><div><strong>Effect</strong><br/>{x.match.rule.effect}</div><div><strong>Recommendation</strong><br/>{x.match.rule.recommendation}</div></div></div><span className={`badge ${x.match.rule.severity}`}>{x.match.rule.severity}</span></div>):<div className="interaction-empty"><strong>No validated matched interaction events.</strong><p>Food records are shown only when the validated knowledge base matches a current medication.</p></div>}</div>
      <div className="card"><div className="card-header"><h2>How You Feel / Safety Reports</h2><span>{safety.length}</span></div>{safety.length?safety.map(s=><div className="ss-report-row" key={s.id}><div className="ss-report-symbol">•</div><div className="ss-report-main"><b>{s.symptom}</b><small>{new Date(s.reported_at).toLocaleString()} · {s.severity} · {s.status}</small>{s.description&&<small>{s.description}</small>}</div><button className="secondary-btn" onClick={() => { setReviewId(s.id); setReviewStatus(s.status === 'Needs review' ? 'Under review' : s.status); }}>Review</button></div>):<div className="ss-empty"><span>✓</span><div><b>No safety reports</b><p>No patient-reported symptoms are currently recorded.</p></div></div>}
        {reviewId && <div className="calendar-detail" style={{marginTop:14}}><div className="field"><label>Review status</label><select value={reviewStatus} onChange={e => setReviewStatus(e.target.value as SafetyReport['status'])}><option>Needs review</option><option>Under review</option><option>Closed</option></select></div><div className="field"><label>Professional note</label><textarea rows={3} value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Document follow-up or clinical action." /></div><div style={{display:'flex',gap:8}}><button className="primary-btn" style={{width:'auto'}} onClick={saveReview}>Save review</button><button className="secondary-btn" onClick={() => setReviewId(null)}>Cancel</button></div></div>}
      </div>
    </div>
  </section>;
}
function Info({label,value}:{label:string;value:string}){return <div className="field"><label>{label}</label><div className="calendar-detail" style={{marginTop:0}}>{value}</div></div>;}
function buildMonth(doses:DoseRecord[]){
  const now=new Date(); const y=now.getFullYear(),m=now.getMonth(); const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate(); const prev=new Date(y,m,0).getDate(); const cells:CalendarCell[]=[];
  for(let i=0;i<first.getDay();i++) cells.push({key:`p${i}`,day:prev-first.getDay()+i+1,other:true,today:false,doses:[]});
  for(let d=1;d<=days;d++){const date=new Date(y,m,d);const key=date.toISOString().slice(0,10);cells.push({key,day:d,other:false,today:d===now.getDate(),doses:doses.filter(x=>x.scheduled_at.slice(0,10)===key)});}
  while(cells.length%7) cells.push({key:`n${cells.length}`,day:cells.length-(first.getDay()+days)+1,other:true,today:false,doses:[]});
  return {label:now.toLocaleDateString([], {month:'long',year:'numeric'}),cells};
}
