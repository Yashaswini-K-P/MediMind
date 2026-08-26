import type { MedicationSchedule, DrugFoodInteraction } from '@/types';

export interface InteractionMatch {
  med: MedicationSchedule;
  rule: DrugFoodInteraction;
  delta: number;
  window: number | null;
  temporallyRelevant: boolean;
  basis: string;
}

export interface FoodAssessment {
  rules: DrugFoodInteraction[];
  relevant: InteractionMatch[];
  matched: InteractionMatch[];
  severity: 'low' | 'moderate' | 'high';
  message: string;
}

function parseMinutes(timeStr: string): number {
  const cleaned = timeStr.trim();
  const parts = cleaned.split(/\s+/);
  const timePart = parts[0];
  const ampm = (parts[1] || '').toLowerCase();
  const [h, m] = timePart.split(':').map(Number);
  let hours = h % 12;
  if (ampm === 'pm') hours += 12;
  return hours * 60 + m;
}

export function hoursBetween(a: string, b: string): number {
  const ma = parseMinutes(a);
  const mb = parseMinutes(b);
  let diff = Math.abs(ma - mb);
  diff = Math.min(diff, 1440 - diff);
  return diff / 60;
}

export function findInteractionRules(
  foodName: string,
  interactionDb: DrugFoodInteraction[],
): DrugFoodInteraction[] {
  const f = foodName.toLowerCase();
  return interactionDb.filter(r =>
    r.food_keywords.some(kw => f.includes(kw.toLowerCase())),
  );
}

export function classifyTemporalExposure(
  med: MedicationSchedule,
  foodTime: string,
  rule: DrugFoodInteraction,
): { delta: number; window: number | null; temporallyRelevant: boolean; basis: string } {
  const delta = hoursBetween(med.scheduled_time, foodTime);
  if (rule.temporal_rule === 'exposure_pattern') {
    return { delta, window: null, temporallyRelevant: true, basis: 'Exposure-pattern rule from the validated interaction record: timing is contextual, not a narrow dose window.' };
  }
  if (rule.temporal_rule === 'drug_specific') {
    return { delta, window: null, temporallyRelevant: true, basis: 'Drug-specific rule from the validated interaction record; product-specific avoidance/review applies regardless of a narrow dose window.' };
  }
  if (rule.temporal_rule === 'dose_proximal' && rule.minimum_interval_hours != null) {
    const window = Number(rule.minimum_interval_hours);
    return { delta, window, temporallyRelevant: delta < window, basis: `Dose-proximal rule from the validated interaction record: separate by at least ${window} h.` };
  }
  return { delta, window: null, temporallyRelevant: false, basis: 'No validated temporal interval is recorded; the app will not invent one.' };
}

export function analyzeTimedFood(
  foodName: string,
  foodTime: string,
  meds: MedicationSchedule[],
  interactionDb: DrugFoodInteraction[],
): FoodAssessment {
  const rules = findInteractionRules(foodName, interactionDb);
  const matched: InteractionMatch[] = [];
  const relevant: InteractionMatch[] = [];

  for (const med of meds) {
    const medRules = rules.filter(r => r.normalized_ingredient === med.medication_name.toLowerCase());
    for (const rule of medRules) {
      const temporal = classifyTemporalExposure(med, foodTime, rule);
      const entry: InteractionMatch = { med, rule, ...temporal };
      relevant.push(entry);
      if (temporal.temporallyRelevant) matched.push(entry);
    }
  }

  let severity: 'low' | 'moderate' | 'high' = 'low';
  if (matched.length) {
    if (matched.some(x => x.rule.severity === 'high')) severity = 'high';
    else if (matched.some(x => x.rule.severity === 'moderate')) severity = 'moderate';
  }

  const message = matched.length
    ? `${matched.length} validated drug-food interaction rule${matched.length > 1 ? 's' : ''} matched the patient's current regimen.`
    : 'No validated drug-specific interaction rule matched the patient\'s current regimen for this food event.';

  return { rules, relevant, matched, severity, message };
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export function mealPeriodFromHour(hour: number): 'Morning' | 'Afternoon' | 'Evening' {
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export function nowTimeStr(): string {
  return new Date().toTimeString().slice(0, 5);
}
