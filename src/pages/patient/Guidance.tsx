import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchInteractions, fetchMedicationSchedules } from '@/lib/api';
import type { DrugFoodInteraction, MedicationSchedule } from '@/types';

export default function PersonalizedGuidance() {
  const { patientProfile } = useAuth();
  const [meds, setMeds] = useState<MedicationSchedule[]>([]);
  const [rules, setRules] = useState<DrugFoodInteraction[]>([]);
  useEffect(() => {
    if (!patientProfile) return;
    Promise.all([fetchMedicationSchedules(patientProfile.id), fetchInteractions()]).then(([m,r]) => { setMeds(m); setRules(r); });
  }, [patientProfile]);

  const applicable = useMemo(() => rules.filter(r => meds.some(m => m.medication_name.toLowerCase() === r.normalized_ingredient.toLowerCase())), [rules, meds]);

  return <section className="page active">
    <div className="pg-shell">
      <div className="pg-header"><div className="pg-title-line"><div className="pg-title-icon">✓</div><div><span className="pg-eyebrow">EVIDENCE-BACKED</span><h2>Personalized Food & Administration Guidance</h2><p className="pg-main-advice">Guidance is generated only from validated interaction records linked to your current medication schedule.</p></div></div><span className="pg-ai-pill">AI explains validated evidence</span></div>
      <div className="pg-patient-strip">
        <div><span>Current medicines</span><strong>{meds.length}</strong></div>
        <div><span>Applicable validated rules</span><strong>{applicable.length}</strong></div>
        <div><span>Evidence status</span><strong>{applicable.length ? 'Available' : 'No match'}</strong></div>
      </div>
      {!applicable.length ? <div className="pg-muted-card"><strong>No personalized food guidance is currently triggered.</strong><p>Record food intake in Food & Interactions to assess it against your current medication regimen.</p></div> :
        applicable.map((r, i) => <GuidanceCard key={r.id || i} rule={r} />)}
    </div>
  </section>;
}

function GuidanceCard({ rule }: { rule: DrugFoodInteraction }) {
  return <div className="pg-card">
    <div className="pg-card-body">
      <div className="pg-title-line"><div className="pg-card-icon">↔</div><div><h3>{rule.normalized_ingredient} + {rule.food_keywords.join(', ')}</h3><p className="pg-main-advice">{rule.recommendation}</p></div><span className={`badge ${rule.severity}`}>{rule.severity}</span></div>
      <div className="pg-recommendation-grid">
        <div className="pg-context-item"><span>🥗</span><div><b>Alternative food</b><p>No substitute is asserted unless a validated source provides one. For exposure-pattern interactions, choose a comparable food pattern only with professional/dietitian guidance.</p></div></div>
        <div className="pg-context-item"><span>⏱</span><div><b>Timing guidance</b><p>{rule.minimum_interval_hours ? `Separate the food exposure from the medicine by at least ${rule.minimum_interval_hours} hours, consistent with the validated rule.` : rule.temporal_rule === 'exposure_pattern' ? 'Timing is contextual; consistency of exposure matters more than a single dose window.' : 'Follow the product-specific administration instructions.'}</p></div></div>
        <div className="pg-context-item"><span>⚖</span><div><b>Amount / exposure guidance</b><p>{rule.exposure_rule || 'No validated amount-specific adjustment is recorded. Avoid making an amount change solely from this app.'}</p></div></div>
      </div>
      <div className="pg-detail"><strong>Mechanism:</strong> {rule.mechanism}<br/><strong>Effect:</strong> {rule.effect}</div>
      <div className="pg-evidence-explain">Evidence level {rule.evidence_level} · {rule.evidence_type || 'Clinical evidence'} · {rule.jurisdiction} · {rule.status}</div>
    </div>
  </div>;
}
