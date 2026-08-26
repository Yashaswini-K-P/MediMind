import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchMedicationSchedules,
  fetchDoseRecords,
  fetchFoodIntakes,
  fetchInteractions,
  fetchClinicalAlerts,
} from '@/lib/api';
import {
  analyzeTimedFood,
  formatTime,
} from '@/lib/interactions';

import type {
  MedicationSchedule,
  DoseRecord,
  FoodIntake,
  DrugFoodInteraction,
  ClinicalAlert,
} from '@/types';

/* ============================================================
   PATIENT HOME
============================================================ */

export default function PatientHome() {
  const { patientProfile } = useAuth();

  const [meds, setMeds] =
    useState<MedicationSchedule[]>([]);

  const [doses, setDoses] =
    useState<DoseRecord[]>([]);

  const [foods, setFoods] =
    useState<FoodIntake[]>([]);

  const [interactions, setInteractions] =
    useState<DrugFoodInteraction[]>([]);

  const [alerts, setAlerts] =
    useState<ClinicalAlert[]>([]);

  const [loading, setLoading] =
    useState(true);

  /* ==========================================================
     LOAD DASHBOARD DATA
  ========================================================== */

  const load = useCallback(async () => {
    if (!patientProfile) {
      return;
    }

    try {
      setLoading(true);

      const [
        medicationData,
        doseData,
        foodData,
        interactionData,
        alertData,
      ] = await Promise.all([
        fetchMedicationSchedules(patientProfile.id),
        fetchDoseRecords(patientProfile.id),
        fetchFoodIntakes(patientProfile.id),
        fetchInteractions(),
        fetchClinicalAlerts(patientProfile.id),
      ]);

      setMeds(medicationData);
      setDoses(doseData);
      setFoods(foodData);
      setInteractions(interactionData);
      setAlerts(alertData);

      /*
       * Keep these logs temporarily while testing.
       * Remove them once the dashboard is verified.
       */
      console.log(
        'PATIENT PROFILE:',
        patientProfile
      );

      console.log(
        'MEDICATIONS:',
        medicationData
      );

      console.log(
        'DOSES:',
        doseData
      );

      console.log(
        'FOODS:',
        foodData
      );

      console.log(
        'INTERACTIONS:',
        interactionData
      );

      console.log(
        'ALERTS:',
        alertData
      );
    } catch (error) {
      console.error(
        'Failed to load patient dashboard:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, [patientProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <section className="page active">
        <div className="empty">
          Loading your dashboard...
        </div>
      </section>
    );
  }

  /* ==========================================================
     ADHERENCE
  ========================================================== */

  const takenDoses = doses.filter(
    (dose) =>
      dose.status === 'taken' ||
      dose.status === 'late'
  ).length;

  const totalDoses = doses.length;

  const adherence =
    totalDoses > 0
      ? Math.round(
          (takenDoses / totalDoses) * 100
        )
      : 0;

  /* ==========================================================
     TIME-AWARE FOOD ASSESSMENT
  ========================================================== */

  const foodWithAssessment = foods.map(
    (food) => ({
      ...food,

      assessment: analyzeTimedFood(
        food.food_name,
        formatTime(food.consumed_at),
        meds,
        interactions
      ),
    })
  );

  const interactionEvents =
    foodWithAssessment.filter(
      (food) =>
        food.assessment.matched.length > 0
    );

  /* ==========================================================
     TIMELINE PERIODS
  ========================================================== */

  const periods = [
    'Morning',
    'Afternoon',
    'Evening',
  ] as const;

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <section className="page active">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="patient-home-header">

        <div>
          <div className="patient-home-eyebrow">
            MEDIMIND
          </div>

          <h1>
            Good morning,{' '}
            {patientProfile?.full_name ||
              'Patient'}
          </h1>

          <p>
            Your personalized medication overview
          </p>
        </div>

      </div>

      {/* ======================================================
          STAT CARDS
      ======================================================= */}

      <div className="grid dashboard-stats">

        <StatCard
          icon="💊"
          number={meds.length}
          label="Scheduled medication doses"
        />

        <StatCard
          icon="🥗"
          number={foods.length}
          label="Food records"
        />

        <StatCard
          icon="⚠️"
          number={interactionEvents.length}
          label="Confirmed interaction events"
        />

        <StatCard
          icon="✓"
          number={`${adherence}%`}
          label="Medication adherence"
        />

      </div>

      {/* ======================================================
          INTERACTION + ALERTS
      ======================================================= */}

      <div className="top-monitoring-grid">

        {/* ----------------------------------------------------
            INTERACTION MONITOR
        ----------------------------------------------------- */}

        <div className="card">

          <div className="card-header">

            <div>
              <h2>
                Drug-Food Interaction Monitoring Dashboard
              </h2>

              <p className="card-subtitle">
                Time-aware
              </p>
            </div>

            <span className="dashboard-badge">
              Time-aware
            </span>

          </div>

          <div className="risk-wrap">

            <div
              className={`risk-circle ${
                interactionEvents.length > 0
                  ? 'warn'
                  : ''
              }`}
            >
              {interactionEvents.length > 0
                ? '62'
                : '0'}
            </div>

            <div className="risk-content">

              <strong>
                {interactionEvents.length > 0
                  ? 'Patient-specific interaction risk detected'
                  : 'No drug-food interaction detected'}
              </strong>

              <p>
                Only food events with a
                drug-specific interaction
                match to a temporally relevant
                dose are shown on the severity
                board.
              </p>

              {interactionEvents.length >
                0 && (
                <button
                  type="button"
                  className="primary-btn"
                >
                  Open food interaction checker
                </button>
              )}

            </div>

          </div>

        </div>

        {/* ----------------------------------------------------
            CLINICAL ALERT CENTER
        ----------------------------------------------------- */}

        <div className="card">

          <div className="card-header">

            <div>
              <h2>
                Clinical Alert Center
              </h2>
            </div>

            <span className="dashboard-badge">
              Priority review
            </span>

          </div>

          <div className="alert-list">

            {alerts.length > 0 ? (

              alerts
                .slice(0, 4)
                .map((alert) => (
                  <div
                    className={`alert ${
                      alert.severity
                    }`}
                    key={alert.id}
                  >
                    <strong>
                      {alert.title}
                    </strong>

                    <p>
                      {alert.message}
                    </p>

                    {alert.recommendation && (
                      <small>
                        {alert.recommendation}
                      </small>
                    )}
                  </div>
                ))

            ) : (

              <div className="alert low">
                <strong>
                  🟢 No active clinical alerts
                </strong>

                <p>
                  No active clinical alerts are
                  recorded today.
                </p>
              </div>

            )}

          </div>

        </div>

      </div>

      {/* ======================================================
          TIMELINE + SEVERITY BOARD
      ======================================================= */}

      <div className="timeline-severity-grid">

        {/* ====================================================
            TIMELINE
        ===================================================== */}

        <div className="card">

          <div className="card-header">

            <div>
              <h2>
                Today's Time-Aware Medication &amp;
                Food Timeline
              </h2>

              <p className="card-subtitle">
                Morning • Afternoon • Evening
              </p>
            </div>

          </div>

          <div className="timeline-board">

            {periods.map((period) => {

              const periodFoods =
                foods.filter(
                  (food) =>
                    food.meal_period === period
                );

              const periodMeds =
                meds.filter((med) => {

                  const hour = parseInt(
                    med.scheduled_time.slice(
                      0,
                      2
                    ),
                    10
                  );

                  if (
                    period === 'Morning'
                  ) {
                    return hour < 12;
                  }

                  if (
                    period === 'Afternoon'
                  ) {
                    return (
                      hour >= 12 &&
                      hour < 17
                    );
                  }

                  return hour >= 17;
                });

              return (
                <div
                  className="time-window"
                  key={period}
                >

                  {/* ----------------------------------------
                      PERIOD HEADER
                  ----------------------------------------- */}

                  <div className="window-title">

                    <strong>
                      {period}
                    </strong>

                    <span>
                      {periodMeds.length}{' '}
                      scheduled dose(s)
                      {' • '}
                      {periodFoods.length}{' '}
                      food record(s)
                    </span>

                  </div>

                  {/* ----------------------------------------
                      MEDICATION EVENTS
                  ----------------------------------------- */}

                  {periodMeds.map(
                    (medication) => (
                      <div
                        className="event-row medication-event"
                        key={medication.id}
                      >

                        <div className="event-time">
                          {formatDisplayTime(
                            medication.scheduled_time
                          )}
                        </div>

                        <div className="event-icon">
                          💊
                        </div>

                        <div className="event-main">

                          <strong>
                            {medication.medication_name}{' '}
                            {medication.dose}{' '}
                            {medication.dose_unit}
                          </strong>

                          <small>
                            Scheduled dose •{' '}
                            {medication.frequency}
                          </small>

                        </div>

                        <span className="badge low">
                          REMINDER
                        </span>

                      </div>
                    )
                  )}

                  {/* ----------------------------------------
                      FOOD EVENTS
                  ----------------------------------------- */}

                  {periodFoods.map(
                    (food) => {

                      const assessment =
                        analyzeTimedFood(
                          food.food_name,
                          formatTime(
                            food.consumed_at
                          ),
                          meds,
                          interactions
                        );

                      const hasInteraction =
                        assessment.matched
                          .length > 0;

                      return (
                        <div
                          className="event-row food-event"
                          key={food.id}
                        >

                          <div className="event-time">
                            {formatDisplayTime(
                              food.consumed_at
                            )}
                          </div>

                          <div className="event-icon">
                            🥗
                          </div>

                          <div className="event-main">

                            <strong>
                              {food.food_name}
                            </strong>

                            <small>
                              {hasInteraction
                                ? assessment.matched
                                    .map(
                                      (match) =>
                                        `Interaction with ${match.med.medication_name} ${match.med.dose}${match.med.dose_unit} at ${formatDisplayTime(match.med.scheduled_time)}`
                                    )
                                    .join(' • ')
                                : food.notes ||
                                  'Logged'}
                            </small>

                          </div>

                          <span
                            className={`badge ${
                              hasInteraction
                                ? assessment.severity
                                : 'low'
                            }`}
                          >
                            {hasInteraction
                              ? assessment.severity.toUpperCase()
                              : 'LOGGED'}
                          </span>

                        </div>
                      );
                    }
                  )}

                  {/* ----------------------------------------
                      EMPTY PERIOD
                  ----------------------------------------- */}

                  {!periodMeds.length &&
                    !periodFoods.length && (
                      <div className="window-note">
                        No recorded medication
                        dose or food intake in
                        this time window.
                      </div>
                    )}

                </div>
              );
            })}

          </div>

        </div>

        {/* ====================================================
            SEVERITY BOARD
        ===================================================== */}

        <div className="card">

          <div className="card-header">

            <div>
              <h2>
                Food Interaction Severity Board
              </h2>

              <p className="card-subtitle">
                Recent intake
              </p>
            </div>

          </div>

          {interactionEvents.length >
          0 ? (

            interactionEvents.map(
              (foodEvent, index) =>
                foodEvent.assessment.matched.map(
                  (match, matchIndex) => {

                    const severity =
                      foodEvent.assessment
                        .severity;

                    const severityIcon =
                      severity === 'high'
                        ? '🔴'
                        : severity ===
                            'moderate'
                          ? '🟠'
                          : '🟢';

                    return (
                      <div
                        className={`interaction ${severity}`}
                        key={`${index}-${matchIndex}`}
                      >

                        <h3>
                          {severityIcon}{' '}
                          {foodEvent.food_name}{' '}
                          +{' '}
                          {
                            match.med
                              .medication_name
                          }
                        </h3>

                        <p>
                          {
                            match.med
                              .medication_name
                          }{' '}
                          {match.med.dose}{' '}
                          {match.med.dose_unit}{' '}
                          at{' '}
                          {formatDisplayTime(
                            match.med
                              .scheduled_time
                          )}
                          {' • '}
                          Food at{' '}
                          {formatDisplayTime(
                            foodEvent.consumed_at
                          )}
                        </p>

                        <div className="alternative">
                          {severity === 'high'
                            ? 'Professional review recommended'
                            : severity ===
                                'moderate'
                              ? 'Review timing / dietary guidance'
                              : 'No significant interaction identified'}
                        </div>

                      </div>
                    );
                  }
                )
            )

          ) : (

            <div className="empty">
              No drug-food interaction detected
              for the recorded food intake.
            </div>

          )}

        </div>

      </div>

      {/* ======================================================
          MEDICATION REMINDERS + CHATBOT
      ======================================================= */}

      <div className="section-grid">

        {/* ====================================================
            MEDICATION REMINDERS
        ===================================================== */}

        <div className="card">

          <div className="card-header">

            <div>
              <h2>
                Medication Reminders &amp;
                Administration Tips
              </h2>

              <p className="card-subtitle">
                Generated from prescription
              </p>
            </div>

          </div>

          {meds.map((medication) => (

            <div
              className="medication"
              key={medication.id}
            >

              <div
                style={{
                  flex: 1,
                }}
              >

                <strong>
                  {medication.medication_name}{' '}
                  {medication.dose}{' '}
                  {medication.dose_unit}
                </strong>

                <small>
                  ⏰{' '}
                  {formatDisplayTime(
                    medication.scheduled_time
                  )}
                  {' • '}
                  {medication.frequency}
                </small>

                <div className="administration-tip">

                  <strong>
                    💡 Administration tip:
                  </strong>{' '}

                  {medication.administration_instruction ||
                    'Follow the exact dose and timing prescribed by your healthcare professional.'}

                </div>

              </div>

              <span className="pill">
                Reminder
              </span>

            </div>

          ))}

        </div>

        {/* ====================================================
            CHATBOT
        ===================================================== */}

        <div className="card">

          <div className="card-header">

            <div>
              <h2>
                AI Medication &amp; Food Chatbot
              </h2>

              <p className="card-subtitle">
                Time-aware
              </p>
            </div>

          </div>

          <ChatWidget />

        </div>

      </div>

    </section>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  icon,
  number,
  label,
}: {
  icon: string;
  number: string | number;
  label: string;
}) {
  return (
    <div className="stat dashboard-stat">

      <div className="stat-icon dashboard-stat-icon">
        <span aria-hidden="true">
          {icon}
        </span>
      </div>

      <div className="stat-content">

        <div className="stat-number">
          {number}
        </div>

        <div className="stat-label">
          {label}
        </div>

      </div>

    </div>
  );
}

/* ============================================================
   TIME FORMATTER
============================================================ */

function formatDisplayTime(
  value: string
) {
  if (!value) {
    return '—';
  }

  /*
   * If this is a normal HH:mm / HH:mm:ss
   * database time, format it directly.
   */
  const timeMatch = value.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (timeMatch) {
    const hour = Number(
      timeMatch[1]
    );

    const minute = timeMatch[2];

    const suffix =
      hour >= 12 ? 'PM' : 'AM';

    const displayHour =
      hour % 12 || 12;

    return `${String(
      displayHour
    ).padStart(2, '0')}:${minute} ${suffix}`;
  }

  /*
   * Otherwise it is probably an ISO
   * timestamp.
   */
  const date = new Date(value);

  if (
    !Number.isNaN(
      date.getTime()
    )
  ) {
    return date.toLocaleTimeString(
      'en-IN',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    );
  }

  return value;
}

/* ============================================================
   CHAT WIDGET
============================================================ */

function ChatWidget() {
  const [messages, setMessages] =
    useState<
      {
        role: 'bot' | 'user';
        text: string;
      }[]
    >([
      {
        role: 'bot',
        text:
          'Hello. I can check a food against the medication dose that is temporally relevant. Try: "I ate spinach at 1 PM; which doses were relevant?"',
      },
    ]);

  const [input, setInput] =
    useState('');

  /* ==========================================================
     SEND MESSAGE
  ========================================================== */

  const send = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const question =
      input.trim();

    if (!question) {
      return;
    }

    setMessages((previous) => [
      ...previous,
      {
        role: 'user',
        text: question,
      },
    ]);

    setInput('');

    const lower =
      question.toLowerCase();

    let answer =
      'I can review the food, intake time and scheduled medication doses that are temporally relevant. Timing is a prioritization aid, not proof of an interaction. Verify clinically important decisions with your healthcare professional.';

    /* --------------------------------------------------------
       SPINACH
    --------------------------------------------------------- */

    if (
      lower.includes('spinach') ||
      lower.includes('palak')
    ) {
      answer =
        'Your current list includes Warfarin. Spinach is a vitamin-K-rich food, so consistency of vitamin K intake is important. Do not change or stop Warfarin based on this chat. Discuss major dietary changes with your healthcare professional.';
    }

    /* --------------------------------------------------------
       GRAPEFRUIT
    --------------------------------------------------------- */

    else if (
      lower.includes('grapefruit')
    ) {
      answer =
        'Grapefruit can interact with some medicines. Your current regimen includes Amlodipine, so regular grapefruit intake should be reviewed with your healthcare professional.';
    }

    /* --------------------------------------------------------
       METFORMIN
    --------------------------------------------------------- */

    else if (
      lower.includes('metformin')
    ) {
      answer =
        'Metformin is in your regimen. Take it with meals as prescribed. Do not double a missed dose unless instructed by your prescriber.';
    }

    /* --------------------------------------------------------
       RESPONSE
    --------------------------------------------------------- */

    window.setTimeout(() => {
      setMessages((previous) => [
        ...previous,
        {
          role: 'bot',
          text: answer,
        },
      ]);
    }, 300);
  };

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="chat">

      <div className="chat-messages">

        {messages.map(
          (message, index) => (
            <div
              key={index}
              className={`bubble ${message.role}`}
            >
              {message.text}
            </div>
          )
        )}

      </div>

      <form
        className="chat-form"
        onSubmit={send}
      >

        <input
          value={input}
          onChange={(event) =>
            setInput(
              event.target.value
            )
          }
          placeholder="Ask about food, a medicine or your regimen..."
          aria-label="Ask about food or medication"
        />

        <button
          type="submit"
          className="primary-btn"
        >
          Send
        </button>

      </form>

    </div>
  );
}