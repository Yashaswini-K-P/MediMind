import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Patient {
  id: string;
  patient_code: string | null;
  full_name: string;
}

interface Medication {
  id: string;
  patient_id: string;
  medication_name: string;
  dose: string;
  active: boolean;
}

interface DoseRecord {
  id: string;
  patient_id: string;
  medication_name: string | null;
  dose: string | null;
  scheduled_at: string;
  taken_at: string | null;
  status: string | null;
}

type DoseStatus =
  | 'taken'
  | 'missed'
  | 'late'
  | 'scheduled';

interface CalendarDose {
  id: string;
  medicationName: string;
  dose: string;
  scheduledAt: Date;
  takenAt: Date | null;
  status: DoseStatus;
}

interface MedicationStats {
  name: string;
  dose: string;
  scheduled: number;
  taken: number;
  missed: number;
  late: number;
  adherence: number;
}

const DAYS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function MedicationMonitoring() {
  const { user } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] =
    useState<string>('');

  const [medications, setMedications] = useState<Medication[]>(
    []
  );

  const [doseRecords, setDoseRecords] = useState<DoseRecord[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * Start with current month.
   */
  const [currentMonth, setCurrentMonth] = useState(
    new Date().getMonth()
  );

  const [currentYear, setCurrentYear] = useState(
    new Date().getFullYear()
  );

  /*
   * ---------------------------------------------------------
   * LOAD ASSIGNED PATIENTS
   * ---------------------------------------------------------
   */
  useEffect(() => {
    async function loadPatients() {
      if (!user) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        /*
         * Assignments use auth.uid() as professional_id.
         */
        const {
          data: assignments,
          error: assignmentError,
        } = await supabase
          .from('assignments')
          .select('patient_id')
          .eq('professional_id', user.id)
          .eq('status', 'active');

        if (assignmentError) {
          throw assignmentError;
        }

        const patientIds = (assignments ?? []).map(
          (row) => row.patient_id
        );

        if (patientIds.length === 0) {
          setPatients([]);
          setSelectedPatientId('');
          setLoading(false);
          return;
        }

        /*
         * Load patient profiles.
         */
        const {
          data: patientData,
          error: patientError,
        } = await supabase
          .from('patient_profiles')
          .select(`
            id,
            patient_code,
            full_name
          `)
          .in('id', patientIds)
          .order('full_name', {
            ascending: true,
          });

        if (patientError) {
          throw patientError;
        }

        const loadedPatients =
          (patientData ?? []) as Patient[];

        setPatients(loadedPatients);

        /*
         * Automatically select first patient.
         */
        if (
          loadedPatients.length > 0 &&
          !selectedPatientId
        ) {
          setSelectedPatientId(
            loadedPatients[0].id
          );
        }
      } catch (err) {
        console.error(
          'Failed to load monitoring patients:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load patients'
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPatients();
  }, [user]);

  /*
   * ---------------------------------------------------------
   * LOAD MEDICATIONS + DOSES FOR SELECTED PATIENT
   * ---------------------------------------------------------
   */
  useEffect(() => {
    async function loadPatientMedicationData() {
      if (!selectedPatientId) {
        setMedications([]);
        setDoseRecords([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        /*
         * Active medication schedules.
         */
        const {
          data: medicationData,
          error: medicationError,
        } = await supabase
          .from('medication_schedules')
          .select(`
            id,
            patient_id,
            medication_name,
            dose,
            active
          `)
          .eq('patient_id', selectedPatientId)
          .eq('active', true)
          .order('medication_name', {
            ascending: true,
          });

        if (medicationError) {
          throw medicationError;
        }

        setMedications(
          (medicationData ?? []) as Medication[]
        );

        /*
         * Dose records.
         *
         * We load all dose records for the selected patient.
         */
        const {
          data: doseData,
          error: doseError,
        } = await supabase
          .from('dose_records')
          .select(`
            id,
            patient_id,
            medication_name,
            dose,
            scheduled_at,
            taken_at,
            status
          `)
          .eq('patient_id', selectedPatientId)
          .order('scheduled_at', {
            ascending: true,
          });

        if (doseError) {
          throw doseError;
        }

        setDoseRecords(
          (doseData ?? []) as DoseRecord[]
        );
      } catch (err) {
        console.error(
          'Failed to load medication monitoring data:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load medication data'
        );

        setMedications([]);
        setDoseRecords([]);
      } finally {
        setLoading(false);
      }
    }

    void loadPatientMedicationData();
  }, [selectedPatientId]);

  /*
   * ---------------------------------------------------------
   * SELECTED PATIENT
   * ---------------------------------------------------------
   */
  const selectedPatient = useMemo(() => {
    return patients.find(
      (patient) =>
        patient.id === selectedPatientId
    );
  }, [patients, selectedPatientId]);

  /*
   * ---------------------------------------------------------
   * CONVERT DATABASE DOSES INTO CALENDAR DOSES
   * ---------------------------------------------------------
   */
  const calendarDoses = useMemo<CalendarDose[]>(() => {
    return doseRecords.map((dose) => {
      const scheduledAt = new Date(
        dose.scheduled_at
      );

      const takenAt = dose.taken_at
        ? new Date(dose.taken_at)
        : null;

      let status: DoseStatus = 'scheduled';

      /*
       * Respect explicit database status first.
       */
      const databaseStatus =
        dose.status?.toLowerCase();

      if (databaseStatus === 'taken') {
        /*
         * A dose can be considered "late" if it was
         * taken after the scheduled time.
         */
        if (
          takenAt &&
          takenAt.getTime() >
            scheduledAt.getTime()
        ) {
          status = 'late';
        } else {
          status = 'taken';
        }
      } else if (
        databaseStatus === 'missed'
      ) {
        status = 'missed';
      } else if (
        databaseStatus === 'late'
      ) {
        status = 'late';
      } else if (
        databaseStatus === 'scheduled'
      ) {
        status = 'scheduled';
      } else {
        /*
         * Fallback when status is empty.
         */
        if (takenAt) {
          if (
            takenAt.getTime() >
            scheduledAt.getTime()
          ) {
            status = 'late';
          } else {
            status = 'taken';
          }
        } else if (
          scheduledAt.getTime() <
          Date.now()
        ) {
          status = 'missed';
        } else {
          status = 'scheduled';
        }
      }

      return {
        id: dose.id,
        medicationName:
          dose.medication_name || 'Medication',
        dose: dose.dose || '',
        scheduledAt,
        takenAt,
        status,
      };
    });
  }, [doseRecords]);

  /*
   * ---------------------------------------------------------
   * CALENDAR DAYS
   * ---------------------------------------------------------
   */
  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      currentYear,
      currentMonth,
      1
    );

    const lastDay = new Date(
      currentYear,
      currentMonth + 1,
      0
    );

    const firstWeekday =
      firstDay.getDay();

    const daysInMonth =
      lastDay.getDate();

    const cells: Array<Date | null> = [];

    /*
     * Empty cells before first day.
     */
    for (
      let i = 0;
      i < firstWeekday;
      i++
    ) {
      cells.push(null);
    }

    /*
     * Actual month days.
     */
    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      cells.push(
        new Date(
          currentYear,
          currentMonth,
          day
        )
      );
    }

    return cells;
  }, [currentMonth, currentYear]);

  /*
   * ---------------------------------------------------------
   * DOSES FOR A PARTICULAR DAY
   * ---------------------------------------------------------
   */
  const getDosesForDay = (
    date: Date
  ) => {
    return calendarDoses.filter(
      (dose) => {
        return (
          dose.scheduledAt.getFullYear() ===
            date.getFullYear() &&
          dose.scheduledAt.getMonth() ===
            date.getMonth() &&
          dose.scheduledAt.getDate() ===
            date.getDate()
        );
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * MONTH DOSES
   * ---------------------------------------------------------
   */
  const monthDoses = useMemo(() => {
    return calendarDoses.filter(
      (dose) => {
        return (
          dose.scheduledAt.getFullYear() ===
            currentYear &&
          dose.scheduledAt.getMonth() ===
            currentMonth
        );
      }
    );
  }, [
    calendarDoses,
    currentMonth,
    currentYear,
  ]);

  /*
   * ---------------------------------------------------------
   * MONTH SUMMARY
   * ---------------------------------------------------------
   *
   * Taken + late = administered.
   * Missed reduces adherence.
   */
  const monthlyStats = useMemo(() => {
    const taken = monthDoses.filter(
      (dose) =>
        dose.status === 'taken'
    ).length;

    const late = monthDoses.filter(
      (dose) =>
        dose.status === 'late'
    ).length;

    const missed = monthDoses.filter(
      (dose) =>
        dose.status === 'missed'
    ).length;

    const scheduled = monthDoses.filter(
      (dose) =>
        dose.status === 'scheduled'
    ).length;

    const completed =
      taken + late;

    const adherenceBase =
      completed + missed;

    const adherence =
      adherenceBase > 0
        ? Math.round(
            (completed /
              adherenceBase) *
              100
          )
        : 0;

    return {
      taken,
      missed,
      late,
      scheduled,
      adherence,
    };
  }, [monthDoses]);

  /*
   * ---------------------------------------------------------
   * MEDICATION-SPECIFIC STATS
   * ---------------------------------------------------------
   */
  const medicationStats =
    useMemo<MedicationStats[]>(() => {
      const map =
        new Map<
          string,
          MedicationStats
        >();

      /*
       * Start with active medications.
       */
      medications.forEach(
        (medication) => {
          const key =
            medication.medication_name
              .trim()
              .toLowerCase();

          if (!map.has(key)) {
            map.set(key, {
              name:
                medication.medication_name,
              dose: medication.dose,
              scheduled: 0,
              taken: 0,
              missed: 0,
              late: 0,
              adherence: 0,
            });
          }
        }
      );

      /*
       * Add monthly dose records.
       */
      monthDoses.forEach(
        (dose) => {
          const key =
            dose.medicationName
              .trim()
              .toLowerCase();

          const existing =
            map.get(key);

          if (!existing) {
            map.set(key, {
              name:
                dose.medicationName,
              dose: dose.dose,
              scheduled: 0,
              taken: 0,
              missed: 0,
              late: 0,
              adherence: 0,
            });
          }

          const row =
            map.get(key)!;

          row.scheduled += 1;

          if (
            dose.status ===
            'taken'
          ) {
            row.taken += 1;
          }

          if (
            dose.status ===
            'missed'
          ) {
            row.missed += 1;
          }

          if (
            dose.status ===
            'late'
          ) {
            row.late += 1;
          }
        }
      );

      /*
       * Calculate adherence.
       */
      map.forEach((row) => {
        const administered =
          row.taken +
          row.late;

        const denominator =
          administered +
          row.missed;

        row.adherence =
          denominator > 0
            ? Math.round(
                (administered /
                  denominator) *
                  100
              )
            : 0;
      });

      return Array.from(
        map.values()
      );
    }, [
      medications,
      monthDoses,
    ]);

  /*
   * ---------------------------------------------------------
   * NAVIGATE MONTH
   * ---------------------------------------------------------
   */
  const changeMonth = (
    direction: number
  ) => {
    const nextMonth =
      currentMonth + direction;

    if (nextMonth < 0) {
      setCurrentMonth(11);
      setCurrentYear(
        currentYear - 1
      );
    } else if (
      nextMonth > 11
    ) {
      setCurrentMonth(0);
      setCurrentYear(
        currentYear + 1
      );
    } else {
      setCurrentMonth(
        nextMonth
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * TODAY
   * ---------------------------------------------------------
   */
  const today = new Date();

  const isToday = (
    date: Date
  ) => {
    return (
      date.getFullYear() ===
        today.getFullYear() &&
      date.getMonth() ===
        today.getMonth() &&
      date.getDate() ===
        today.getDate()
    );
  };

  /*
   * ---------------------------------------------------------
   * TIME FORMAT
   * ---------------------------------------------------------
   */
  const formatTime = (
    date: Date
  ) => {
    return date.toLocaleTimeString(
      [],
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * STATUS LABEL
   * ---------------------------------------------------------
   */
  const statusLabel = (
    status: DoseStatus
  ) => {
    switch (status) {
      case 'taken':
        return 'TAKEN';

      case 'missed':
        return 'MISSED';

      case 'late':
        return 'LATE';

      case 'scheduled':
        return 'SCHEDULED';

      default:
        return '';
    }
  };

  /*
   * ---------------------------------------------------------
   * STATUS CLASS
   * ---------------------------------------------------------
   */
  const statusClass = (
    status: DoseStatus
  ) => {
    switch (status) {
      case 'taken':
        return 'mm-dose-taken';

      case 'missed':
        return 'mm-dose-missed';

      case 'late':
        return 'mm-dose-late';

      case 'scheduled':
        return 'mm-dose-scheduled';

      default:
        return '';
    }
  };

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */
  if (loading && patients.length === 0) {
    return (
      <div className="mm-page">
        <div className="mm-card mm-loading">
          Loading medication monitoring...
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */
  return (
    <div className="mm-page">

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="mm-error">
          <strong>
            Unable to load monitoring data
          </strong>

          <div>
            {error}
          </div>
        </div>
      )}

      {/* =====================================================
          PATIENT SELECTOR
      ====================================================== */}

      <div className="mm-card mm-patient-bar">

        <div>
          <label className="mm-label">
            Patient
          </label>

          <select
            value={selectedPatientId}
            onChange={(event) =>
              setSelectedPatientId(
                event.target.value
              )
            }
            className="mm-select"
          >
            {patients.map(
              (patient) => (
                <option
                  key={patient.id}
                  value={patient.id}
                >
                  {patient.full_name}
                  {patient.patient_code
                    ? ` — ${patient.patient_code}`
                    : ''}
                </option>
              )
            )}
          </select>
        </div>

        <div className="mm-patient-info">

          <span>
            Patient:
          </span>

          <strong>
            {selectedPatient?.full_name ||
              'No patient selected'}
          </strong>

          {selectedPatient?.patient_code && (
            <span>
              #{selectedPatient.patient_code}
            </span>
          )}

        </div>

      </div>

      {/* =====================================================
          CALENDAR HEADER
      ====================================================== */}

      <div className="mm-card">

        <div className="mm-calendar-header">

          <div>
            <h2>
              Dosing Calendar
            </h2>

            <p>
              Medication schedule and
              adherence history
            </p>
          </div>

          <div className="mm-month-navigation">

            <button
              className="mm-nav-button"
              onClick={() =>
                changeMonth(-1)
              }
              aria-label="Previous month"
            >
              ‹
            </button>

            <h3>
              {MONTH_NAMES[
                currentMonth
              ]}{' '}
              {currentYear}
            </h3>

            <button
              className="mm-nav-button"
              onClick={() =>
                changeMonth(1)
              }
              aria-label="Next month"
            >
              ›
            </button>

          </div>

        </div>

        {/* ===================================================
            LEGEND
        ==================================================== */}

        <div className="mm-legend">

          <span>
            <i className="mm-dot mm-dot-taken" />
            Taken
          </span>

          <span>
            <i className="mm-dot mm-dot-missed" />
            Missed
          </span>

          <span>
            <i className="mm-dot mm-dot-late" />
            Late
          </span>

          <span>
            <i className="mm-dot mm-dot-scheduled" />
            Scheduled
          </span>

        </div>

        {/* ===================================================
            CALENDAR
        ==================================================== */}

        <div className="mm-calendar">

          {/* Weekday headings */}
          {DAYS.map(
            (day) => (
              <div
                key={day}
                className="mm-weekday"
              >
                {day}
              </div>
            )
          )}

          {/* Calendar cells */}
          {calendarDays.map(
            (date, index) => {

              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="mm-day mm-day-empty"
                  />
                );
              }

              const doses =
                getDosesForDay(
                  date
                );

              return (
                <div
                  key={date.toISOString()}
                  className={`mm-day ${
                    isToday(date)
                      ? 'mm-day-today'
                      : ''
                  }`}
                >

                  <div className="mm-day-number">
                    {date.getDate()}

                    {isToday(date) && (
                      <span className="mm-today">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="mm-day-doses">

                    {doses.map(
                      (dose) => (
                        <div
                          key={dose.id}
                          className={`mm-dose ${statusClass(
                            dose.status
                          )}`}
                        >

                          <div className="mm-dose-name">
                            {dose.medicationName}
                          </div>

                          <div className="mm-dose-meta">
                            {dose.dose}
                          </div>

                          <div className="mm-dose-time">
                            {formatTime(
                              dose.scheduledAt
                            )}{' '}
                            •{' '}
                            {statusLabel(
                              dose.status
                            )}
                          </div>

                        </div>
                      )
                    )}

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>

      {/* =====================================================
          MONTH SUMMARY
      ====================================================== */}

      <div className="mm-stats-grid">

        <StatCard
          label="Taken doses"
          value={monthlyStats.taken}
          type="taken"
        />

        <StatCard
          label="Missed doses"
          value={monthlyStats.missed}
          type="missed"
        />

        <StatCard
          label="Late doses"
          value={monthlyStats.late}
          type="late"
        />

        <StatCard
          label="Adherence"
          value={`${monthlyStats.adherence}%`}
          type="adherence"
        />

      </div>

      {/* =====================================================
          HOW TO READ
      ====================================================== */}

      <div className="mm-card mm-help">

        <strong>
          How to read
        </strong>

        <p>
          Each medication dose appears on
          its scheduled date and time.
          Green = taken, red = missed,
          amber = late, grey = future /
          scheduled.
        </p>

      </div>

      {/* =====================================================
          INDIVIDUAL MEDICATION ADHERENCE
      ====================================================== */}

      <div className="mm-card">

        <div className="mm-section-header">

          <div>
            <h2>
              Individual Medication Adherence
            </h2>

            <p>
              Monthly dose performance
            </p>
          </div>

        </div>

        {medicationStats.length === 0 ? (
          <div className="mm-empty">
            No medication dose data is
            available for this month.
          </div>
        ) : (
          <div className="mm-table-wrapper">

            <table className="mm-table">

              <thead>
                <tr>
                  <th>
                    Medication
                  </th>

                  <th>
                    Dose
                  </th>

                  <th>
                    Scheduled Doses
                  </th>

                  <th>
                    Taken
                  </th>

                  <th>
                    Missed
                  </th>

                  <th>
                    Late
                  </th>

                  <th>
                    Adherence
                  </th>
                </tr>
              </thead>

              <tbody>
                {medicationStats.map(
                  (medication) => (
                    <tr
                      key={`${medication.name}-${medication.dose}`}
                    >

                      <td>
                        <strong>
                          {medication.name}
                        </strong>
                      </td>

                      <td>
                        {medication.dose ||
                          '—'}
                      </td>

                      <td>
                        {medication.scheduled}
                      </td>

                      <td className="mm-positive">
                        {medication.taken}
                      </td>

                      <td className="mm-negative">
                        {medication.missed}
                      </td>

                      <td className="mm-warning">
                        {medication.late}
                      </td>

                      <td>
                        <div className="mm-adherence-cell">

                          <strong>
                            {medication.adherence}%
                          </strong>

                          <div className="mm-progress">
                            <div
                              className="mm-progress-fill"
                              style={{
                                width: `${medication.adherence}%`,
                              }}
                            />
                          </div>

                        </div>
                      </td>

                    </tr>
                  )
                )}
              </tbody>

            </table>

          </div>
        )}

        <div className="mm-note">
          Individual adherence counts taken and
          late doses as administered doses.
          Missed doses reduce adherence.
        </div>

      </div>

      {/* =====================================================
          CURRENT MEDICATION REGIMEN
      ====================================================== */}

      <div className="mm-card">

        <div className="mm-section-header">

          <div>
            <h2>
              Medication Monitoring
            </h2>

            <p>
              Current regimen
            </p>
          </div>

        </div>

        {medications.length === 0 ? (
          <div className="mm-empty">
            No active medication schedules
            found for this patient.
          </div>
        ) : (
          <div className="mm-regimen">

            {medications.map(
              (medication) => (
                <div
                  key={medication.id}
                  className="mm-regimen-item"
                >

                  <div className="mm-regimen-main">

                    <div className="mm-regimen-icon">
                      💊
                    </div>

                    <div>

                      <h3>
                        {medication.medication_name}{' '}
                        {medication.dose}
                        {medication.dose &&
                        !/[a-zA-Z]/.test(
                          medication.dose
                        )
                          ? ' mg'
                          : ''}
                      </h3>

                      <p>
                        Active medication schedule
                      </p>

                    </div>

                  </div>

                  <span className="mm-active">
                    Active
                  </span>

                </div>
              )
            )}

          </div>
        )}

      </div>

    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  label,
  value,
  type,
}: {
  label: string;
  value: string | number;
  type:
    | 'taken'
    | 'missed'
    | 'late'
    | 'adherence';
}) {
  return (
    <div className={`mm-stat mm-stat-${type}`}>

      <div className="mm-stat-label">
        {label}
      </div>

      <div className="mm-stat-value">
        {value}
      </div>

    </div>
  );
}