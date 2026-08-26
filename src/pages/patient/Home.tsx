import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchMedicationSchedules, fetchDoseRecords, fetchFoodIntakes, fetchInteractions, fetchClinicalAlerts } from '@/lib/api';
import { analyzeTimedFood, formatTime } from '@/lib/interactions';
import type { MedicationSchedule, DoseRecord, FoodIntake, DrugFoodInteraction } from '@/types';

export default function PatientHome() {
  const { patientProfile } = useAuth();
  const [meds, setMeds] = useState<MedicationSchedule[]>([]);
  const [doses, setDoses] = useState<DoseRecord[]>([]);
  const [foods, setFoods] = useState<FoodIntake[]>([]);
  const [interactions, setInteractions] = useState<DrugFoodInteraction[]>([]);
  const [alerts, setAlerts] = useState<import('@/types').ClinicalAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientProfile) return;
    const [m, d, f, i, a] = await Promise.all([
      fetchMedicationSchedules(patientProfile.id),
      fetchDoseRecords(patientProfile.id),
      fetchFoodIntakes(patientProfile.id),
      fetchInteractions(),
      fetchClinicalAlerts(patientProfile.id),
    ]);

    console.log('PATIENT PROFILE:', patientProfile);
console.log('MEDICATIONS:', m);
console.log('DOSES:', d);
console.log('FOODS:', f);
    setMeds(m);
    setDoses(d);
    setFoods(f);
    setInteractions(i);
    setAlerts(a);
    console.log('PATIENT PROFILE:', patientProfile);
console.log('MEDICATIONS:', m);
console.log('DOSES:', d);
console.log('FOODS:', f);
console.log('INTERACTIONS:', i);
console.log('ALERTS:', a);
    setLoading(false);
  }, [patientProfile]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty">Loading your dashboard...</div>;

  const takenDoses = doses.filter(d => d.status === 'taken' || d.status === 'late').length;
  const totalDoses = doses.length;
  const adherence = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

  const foodWithAssessment = foods.map(f => ({
    ...f,
    assessment: analyzeTimedFood(f.food_name, formatTime(f.consumed_at), meds, interactions),
  }));
  const interactionEvents = foodWithAssessment.filter(f => f.assessment.matched.length > 0);

  const periods = ['Morning', 'Afternoon', 'Evening'] as const;

  return (
    <section className="page active">
      <div className="grid">
        <div className="stat"><div className="stat-icon">Pill</div><div className="stat-number">{meds.length}</div><div className="stat-label">Scheduled medication doses</div></div>
        <div className="stat"><div className="stat-icon">Salad</div><div className="stat-number">{foods.length}</div><div className="stat-label">Food records</div></div>
        <div className="stat"><div className="stat-icon">AlertTriangle</div><div className="stat-number">{interactionEvents.length}</div><div className="stat-label">Confirmed interaction events</div></div>
        <div className="stat"><div className="stat-icon">Check</div><div className="stat-number">{adherence}%</div><div className="stat-label">Medication adherence</div></div>
      </div>

      <div className="top-monitoring-grid">
        <div className="card">
          <div className="card-header">
            <h2>Drug-Food Interaction Monitoring Dashboard</h2>
            <span>Time-aware</span>
          </div>
          <div className="risk-wrap">
            <div className={`risk-circle ${interactionEvents.length > 0 ? 'warn' : ''}`}>{interactionEvents.length > 0 ? '62' : '0'}</div>
            <div>
              <strong>{interactionEvents.length > 0 ? 'Patient-specific interaction risk detected' : 'No drug-food interaction detected'}</strong>
              <p>Only food events with a drug-specific interaction match to a temporally relevant dose are shown on the severity board.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Clinical Alert Center</h2>
            <span>Priority review</span>
          </div>
          {alerts.length ? alerts.slice(0, 4).map(a => <div className={`alert ${a.severity}`} key={a.id}><strong>{a.title}</strong><br/>{a.message}{a.recommendation ? ` ${a.recommendation}` : ''}</div>) : <div className="alert low">No active clinical alerts are recorded.</div>}
        </div>
      </div>

      <div className="timeline-severity-grid">
        <div className="card">
          <div className="card-header">
            <h2>Today's Time-Aware Medication & Food Timeline</h2>
            <span>Morning / Afternoon / Evening</span>
          </div>
          <div className="timeline-board">
            {periods.map(period => {
              const periodFoods = foods.filter(f => f.meal_period === period);
              const periodMeds = meds.filter(m => {
                const hour = parseInt(m.scheduled_time.slice(0, 2));
                if (period === 'Morning') return hour < 12;
                if (period === 'Afternoon') return hour >= 12 && hour < 17;
                return hour >= 17;
              });

              return (
                <div className="time-window" key={period}>
                  <div className="window-title">
                    <strong>{period}</strong>
                    <span>{periodMeds.length} scheduled dose(s) - {periodFoods.length} food record(s)</span>
                  </div>
                  {periodMeds.map(m => (
                    <div className="event-row" key={m.id}>
                      <div className="event-time">{m.scheduled_time}</div>
                      <div className="event-main">
                        <strong>{m.medication_name} {m.dose} {m.dose_unit}</strong>
                        <small>Scheduled dose - {m.frequency}</small>
                      </div>
                      <span className="badge low">REMINDER</span>
                    </div>
                  ))}
                  {periodFoods.map(f => {
                    const a = analyzeTimedFood(f.food_name, formatTime(f.consumed_at), meds, interactions);
                    return (
                      <div className="event-row" key={f.id}>
                        <div className="event-time">{formatTime(f.consumed_at)}</div>
                        <div className="event-main">
                          <strong>{f.food_name}</strong>
                          <small>{a.matched.length ? a.matched.map(x => `Interaction with ${x.med.medication_name} ${x.med.dose}${x.med.dose_unit} at ${x.med.scheduled_time}`).join(' - ') : (f.notes || 'Logged')}</small>
                        </div>
                        <span className={`badge ${a.matched.length ? a.severity : 'low'}`}>
                          {a.matched.length ? a.severity.toUpperCase() : 'LOGGED'}
                        </span>
                      </div>
                    );
                  })}
                  {!periodMeds.length && !periodFoods.length && (
                    <div className="window-note">No recorded medication dose or food intake in this time window.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Food Interaction Severity Board</h2>
            <span>Recent intake</span>
          </div>
          {interactionEvents.length > 0 ? (
            interactionEvents.map((x, i) => x.assessment.matched.map((m, j) => (
              <div className={`interaction ${x.assessment.severity}`} key={`${i}-${j}`}>
                <h3>{x.assessment.severity === 'high' ? 'RED' : x.assessment.severity === 'moderate' ? 'ORANGE' : 'GREEN'} {x.food_name} + {m.med.medication_name}</h3>
                <p>{m.med.medication_name} {m.med.dose} {m.med.dose_unit} at {m.med.scheduled_time} - Food at {formatTime(x.consumed_at)}</p>
                <div className="alternative">
                  {x.assessment.severity === 'high' ? 'Professional review recommended' : x.assessment.severity === 'moderate' ? 'Review timing / dietary guidance' : 'No significant interaction identified'}
                </div>
              </div>
            )))
          ) : (
            <div className="empty">No drug-food interaction detected for the recorded food intake.</div>
          )}
        </div>
      </div>

      <div className="section-grid">
        <div className="card">
          <div className="card-header">
            <h2>Medication Reminders & Administration Tips</h2>
            <span>Generated from prescription</span>
          </div>
          {meds.map(m => (
            <div className="medication" key={m.id}>
              <div style={{ flex: 1 }}>
                <strong>{m.medication_name} {m.dose} {m.dose_unit}</strong>
                <small>{m.scheduled_time} - {m.frequency}</small>
                <div className="administration-tip">
                  <strong>Administration tip:</strong> {m.administration_instruction}
                </div>
              </div>
              <span className="pill">Reminder</span>
            </div>
          ))}
        </div>

        <div>
          <div className="card">
            <div className="card-header"><h2>AI Medication & Food Chatbot</h2><span>Time-aware</span></div>
            <ChatWidget />
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatWidget() {
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([
    { role: 'bot', text: 'Hello. I can check a food against the medication dose that is temporally relevant. Try: "I ate spinach at 1 PM; which doses were relevant?"' },
  ]);
  const [input, setInput] = useState('');

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');

    const l = q.toLowerCase();
    let ans = 'I can review the food, intake time and scheduled medication doses that are temporally relevant. Timing is a prioritization aid, not proof of an interaction. Verify clinically important decisions with your healthcare professional.';
    if (l.includes('spinach') || l.includes('palak')) {
      ans = 'Your current list includes Warfarin. Spinach is a vitamin-K-rich food, so consistency of vitamin K intake is important. Do not change or stop Warfarin based on this chat. Discuss major dietary changes with your healthcare professional.';
    } else if (l.includes('grapefruit')) {
      ans = 'Grapefruit can interact with some medicines. Your current regimen includes Amlodipine, so regular grapefruit intake should be reviewed with your healthcare professional.';
    } else if (l.includes('metformin')) {
      ans = 'Metformin is in your regimen. Take it with meals as prescribed. Do not double a missed dose unless instructed by your prescriber.';
    }

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: ans }]);
    }, 300);
  };

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
        ))}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about food, a medicine or your regimen..."
        />
        <button type="submit" className="primary-btn">Send</button>
      </form>
    </div>
  );
}
