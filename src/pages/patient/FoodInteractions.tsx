import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { fetchMedicationSchedules, fetchFoodIntakes, fetchInteractions, addFoodIntake } from '@/lib/api';
import { analyzeTimedFood, formatTime, mealPeriodFromHour, nowTimeStr } from '@/lib/interactions';
import type { MedicationSchedule, FoodIntake, DrugFoodInteraction } from '@/types';

export default function FoodInteractions() {
  const { patientProfile } = useAuth();
  const { show } = useToast();
  const [meds, setMeds] = useState<MedicationSchedule[]>([]);
  const [foods, setFoods] = useState<FoodIntake[]>([]);
  const [interactions, setInteractions] = useState<DrugFoodInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [foodQuery, setFoodQuery] = useState('');
  const [foodTime, setFoodTime] = useState(nowTimeStr());
  const [mealPeriod, setMealPeriod] = useState<'Morning' | 'Afternoon' | 'Evening'>('Morning');
  const [checkResult, setCheckResult] = useState<ReturnType<typeof analyzeTimedFood> | null>(null);

  const load = useCallback(async () => {
    if (!patientProfile) return;
    const [m, f, i] = await Promise.all([
      fetchMedicationSchedules(patientProfile.id),
      fetchFoodIntakes(patientProfile.id),
      fetchInteractions(),
    ]);
    setMeds(m); setFoods(f); setInteractions(i);
    setLoading(false);
  }, [patientProfile]);

  useEffect(() => { load(); }, [load]);

  const checkTimedFood = () => {
    if (!foodQuery.trim() || !foodTime) { show('Enter the food and intake time'); return; }
    const [h] = foodTime.split(':').map(Number);
    setMealPeriod(mealPeriodFromHour(h));
    const result = analyzeTimedFood(foodQuery.trim(), foodTime, meds, interactions);
    setCheckResult(result);
  };

  const saveFood = async () => {
    if (!patientProfile || !foodQuery.trim()) { show('Enter a food item'); return; }
    const [h] = foodTime.split(':').map(Number);
    const period = mealPeriodFromHour(h);
    const consumedAt = new Date();
    consumedAt.setHours(h, parseInt(foodTime.slice(3, 5)), 0, 0);
    const ok = await addFoodIntake(patientProfile.id, foodQuery.trim(), period, consumedAt.toISOString(), []);
    show(ok ? 'Food recorded with intake time' : 'Failed to record food');
    if (ok) { setFoodQuery(''); setCheckResult(null); load(); }
  };

  if (loading) return <div className="empty">Loading food interactions...</div>;

  return (
    <section className="page active">
      <div className="card">
        <div className="card-header"><h2>Time-Aware Food & Drug Interaction Monitoring</h2><span>Compare food with relevant dose</span></div>
        <div className="food-checker">
          <div className="food-checker-title">
            <div>
              <h3>Record Food Intake</h3>
              <p>Enter the food type and intake time to identify medication doses that are temporally relevant.</p>
            </div>
            <span className="badge neutral">TIME-AWARE</span>
          </div>
          <div className="food-input-row">
            <input value={foodQuery} onChange={e => setFoodQuery(e.target.value)} placeholder="e.g. spinach curry, idli, grapefruit juice" />
            <button className="secondary-btn" onClick={checkTimedFood}>Check</button>
            <button className="primary-btn" style={{ width: 'auto' }} onClick={saveFood}>Save</button>
          </div>
          <div className="food-input-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
            <input type="time" value={foodTime} onChange={e => setFoodTime(e.target.value)} />
            <select value={mealPeriod} onChange={e => setMealPeriod(e.target.value as typeof mealPeriod)}>
              <option>Morning</option><option>Afternoon</option><option>Evening</option>
            </select>
            <button className="secondary-btn" onClick={() => setFoodTime(nowTimeStr())}>Use current time</button>
          </div>
          {checkResult && (
            <div className="check-result">
              <div className={`interaction ${checkResult.severity}`}>
                <div className="result-head">
                  <strong>Assessment: {foodQuery} at {foodTime}</strong>
                  <span className={`badge ${checkResult.severity}`}>{checkResult.severity.toUpperCase()}</span>
                </div>
                <p>{checkResult.message}</p>
                <div className="result-med">
                  <strong>Temporally relevant medication doses</strong>
                  {checkResult.relevant.length > 0 ? (
                    checkResult.relevant.map((x, i) => (
                      <p key={i}>{x.med.medication_name} {x.med.dose} {x.med.dose_unit} - {x.med.scheduled_time} - {x.delta.toFixed(1)} h from food</p>
                    ))
                  ) : <p>No dose fell within the demonstration temporal screen.</p>}
                </div>
                <div className="administration-tip"><strong>Interpretation:</strong> Timing and pharmacokinetic data prioritize the review; validated clinical interaction evidence determines the actual interaction.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Food Intake Timeline</h2><span>Morning / Afternoon / Evening</span></div>
        <div className="timeline-board">
          {foods.map(f => {
            const a = analyzeTimedFood(f.food_name, formatTime(f.consumed_at), meds, interactions);
            return (
              <div className="event-row" key={f.id}>
                <div className="event-time">{formatTime(f.consumed_at)}</div>
                <div className="event-main">
                  <strong>{f.food_name}</strong>
                  <small>{f.meal_period} - {a.relevant.length} temporally relevant dose(s)</small>
                </div>
                <span className={`badge ${a.severity}`}>{a.severity.toUpperCase()}</span>
              </div>
            );
          })}
          {!foods.length && <div className="empty">No food records yet.</div>}
        </div>
      </div>

      <div className="section-grid">
        <div className="card">
          <div className="card-header"><h2>Interaction Results</h2><span>Temporal relevance</span></div>
          {foods.map(f => {
            const a = analyzeTimedFood(f.food_name, formatTime(f.consumed_at), meds, interactions);
            return (
              <div className={`interaction ${a.severity}`} key={f.id}>
                <h3>{f.food_name} - {formatTime(f.consumed_at)}</h3>
                <p>{a.message}</p>
                <div className="alternative">
                  {a.relevant.length > 0
                    ? `Relevant dose(s): ${a.relevant.map(x => `${x.med.medication_name} ${x.med.dose} ${x.med.dose_unit} at ${x.med.scheduled_time} (${x.delta.toFixed(1)} h apart)`).join(', ')}`
                    : 'No temporally relevant dose identified.'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-header"><h2>Safety & Interpretation</h2><span>Human review</span></div>
          <div className="alert high"><strong>Timing does not prove causality.</strong><br />A food being close to a dose does not by itself prove an interaction.</div>
          <div className="alert moderate"><strong>Drug-specific assessment.</strong><br />Different medicines have different food effects, pharmacokinetics and pharmacodynamics.</div>
          <div className="alert low"><strong>Production requirement.</strong><br />Connect the knowledge layer to a validated, versioned clinical drug-information source.</div>
        </div>
      </div>
    </section>
  );
}
