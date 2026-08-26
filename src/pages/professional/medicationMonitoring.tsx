import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Patient {
  id: string;
  patient_code: string | null;
  full_name: string;
}

interface MedicationSchedule {
  id: string;
  patient_id: string;
  medication_name: string;
  dose: string;
  dose_unit: string | null;
  scheduled_time: string;
  frequency: string | null;
  days_of_week: string[] | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
}

interface DoseRecord {
  id: string;
  patient_id: string;
  schedule_id: string | null;
  medication_name: string;
  dose: string | null;
  scheduled_at: string;
  taken_at: string | null;
  status: string;
}

type CalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
};

export default function MedicationMonitoring() {
  const { user } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [doseRecords, setDoseRecords] = useState<DoseRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState(
    new Date()
  );

  const [selectedDate, setSelectedDate] = useState(
    new Date()
  );

  const [selectedPatientId, setSelectedPatientId] =
    useState<string>('all');

  const [selectedStatus, setSelectedStatus] =
    useState<string>('all');

  useEffect(() => {
    async function loadMedicationMonitoring() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        /*
         * ----------------------------------------------------
         * 1. Find patients assigned to this professional
         * ----------------------------------------------------
         */

        const { data: assignments, error: assignmentError } =
          await supabase
            .from('assignments')
            .select('patient_id')
            .eq('professional_id', user.id)
            .eq('status', 'active');

        if (assignmentError) {
          throw assignmentError;
        }

        const patientIds = (assignments ?? []).map(
          assignment => assignment.patient_id
        );

        if (patientIds.length === 0) {
          setPatients([]);
          setSchedules([]);
          setDoseRecords([]);
          setLoading(false);
          return;
        }

        /*
         * ----------------------------------------------------
         * 2. Patient profiles
         * ----------------------------------------------------
         */

        const { data: patientData, error: patientError } =
          await supabase
            .from('patient_profiles')
            .select(`
              id,
              patient_code,
              full_name
            `)
            .in('id', patientIds);

        if (patientError) {
          throw patientError;
        }

        /*
         * ----------------------------------------------------
         * 3. Medication schedules
         * ----------------------------------------------------
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
            dose_unit,
            scheduled_time,
            frequency,
            days_of_week,
            start_date,
            end_date,
            active
          `)
          .in('patient_id', patientIds)
          .eq('active', true);

        if (medicationError) {
          throw medicationError;
        }

        /*
         * ----------------------------------------------------
         * 4. Dose records
         * ----------------------------------------------------
         */

        const { data: doseData, error: doseError } =
          await supabase
            .from('dose_records')
            .select(`
              id,
              patient_id,
              schedule_id,
              medication_name,
              dose,
              scheduled_at,
              taken_at,
              status
            `)
            .in('patient_id', patientIds)
            .order('scheduled_at', {
              ascending: true,
            });

        if (doseError) {
          throw doseError;
        }

        setPatients((patientData ?? []) as Patient[]);
        setSchedules(
          (medicationData ?? []) as MedicationSchedule[]
        );
        setDoseRecords(
          (doseData ?? []) as DoseRecord[]
        );
      } catch (err) {
        console.error(
          'Failed to load medication monitoring:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load medication monitoring'
        );
      } finally {
        setLoading(false);
      }
    }

    void loadMedicationMonitoring();
  }, [user]);

  /*
   * --------------------------------------------------------
   * Helpers
   * --------------------------------------------------------
   */

  function formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(dateString: string) {
    const [year, month, day] =
      dateString.split('-').map(Number);

    return new Date(
      year,
      month - 1,
      day
    );
  }

  function formatTime(time: string) {
    if (!time) return '—';

    const [hourString, minuteString] =
      time.split(':');

    const hour = Number(hourString);
    const minute = Number(minuteString);

    const date = new Date();

    date.setHours(hour);
    date.setMinutes(minute);

    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function getPatientName(patientId: string) {
    return (
      patients.find(
        patient => patient.id === patientId
      )?.full_name ?? 'Unknown patient'
    );
  }

  function getPatientCode(patientId: string) {
    return (
      patients.find(
        patient => patient.id === patientId
      )?.patient_code ?? '—'
    );
  }

  /*
   * --------------------------------------------------------
   * Calendar generation
   * --------------------------------------------------------
   */

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    );

    const lastDay = new Date(
      year,
      month + 1,
      0
    );

    const startDay = firstDay.getDay();

    const totalDays = lastDay.getDate();

    const days: CalendarDay[] = [];

    /*
     * Previous month's trailing days
     */

    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(
        year,
        month,
        -i
      );

      days.push({
        date,
        dateKey: formatDateKey(date),
        isCurrentMonth: false,
      });
    }

    /*
     * Current month
     */

    for (
      let day = 1;
      day <= totalDays;
      day++
    ) {
      const date = new Date(
        year,
        month,
        day
      );

      days.push({
        date,
        dateKey: formatDateKey(date),
        isCurrentMonth: true,
      });
    }

    /*
     * Next month's leading days
     */

    while (days.length < 42) {
      const date = new Date(
        year,
        month,
        totalDays + (days.length - startDay + 1)
      );

      days.push({
        date,
        dateKey: formatDateKey(date),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  /*
   * --------------------------------------------------------
   * Dose records for calendar
   * --------------------------------------------------------
   */

  const doseCountByDate = useMemo(() => {
    const map: Record<string, number> = {};

    doseRecords.forEach(record => {
      if (
        selectedPatientId !== 'all' &&
        record.patient_id !== selectedPatientId
      ) {
        return;
      }

      const dateKey = formatDateKey(
        new Date(record.scheduled_at)
      );

      map[dateKey] =
        (map[dateKey] ?? 0) + 1;
    });

    return map;
  }, [doseRecords, selectedPatientId]);

  /*
   * --------------------------------------------------------
   * Selected day records
   * --------------------------------------------------------
   */

  const selectedDayRecords = useMemo(() => {
    const selectedKey =
      formatDateKey(selectedDate);

    return doseRecords
      .filter(record => {
        const recordKey =
          formatDateKey(
            new Date(record.scheduled_at)
          );

        if (recordKey !== selectedKey) {
          return false;
        }

        if (
          selectedPatientId !== 'all' &&
          record.patient_id !== selectedPatientId
        ) {
          return false;
        }

        if (
          selectedStatus !== 'all' &&
          record.status !== selectedStatus
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(
            a.scheduled_at
          ).getTime() -
          new Date(
            b.scheduled_at
          ).getTime()
      );
  }, [
    doseRecords,
    selectedDate,
    selectedPatientId,
    selectedStatus,
  ]);

  /*
   * --------------------------------------------------------
   * Scheduled medications for selected day
   *
   * This allows us to display schedules even when a dose
   * record hasn't been created yet.
   * --------------------------------------------------------
   */

  const selectedDaySchedules = useMemo(() => {
    const selectedKey =
      formatDateKey(selectedDate);

    const selectedDateOnly =
      parseLocalDate(selectedKey);

    const dayName =
      selectedDateOnly
        .toLocaleDateString('en-US', {
          weekday: 'long',
        })
        .toLowerCase();

    return schedules.filter(schedule => {
      if (
        selectedPatientId !== 'all' &&
        schedule.patient_id !== selectedPatientId
      ) {
        return false;
      }

      const startDate =
        parseLocalDate(schedule.start_date);

      if (selectedDateOnly < startDate) {
        return false;
      }

      if (schedule.end_date) {
        const endDate =
          parseLocalDate(schedule.end_date);

        if (selectedDateOnly > endDate) {
          return false;
        }
      }

      if (
        schedule.days_of_week &&
        schedule.days_of_week.length > 0
      ) {
        return schedule.days_of_week.some(
          day =>
            day.toLowerCase() === dayName
        );
      }

      return true;
    });
  }, [
    schedules,
    selectedDate,
    selectedPatientId,
  ]);

  /*
   * --------------------------------------------------------
   * Summary
   * --------------------------------------------------------
   */

  const selectedDaySummary = useMemo(() => {
    const total = selectedDayRecords.length;

    const taken =
      selectedDayRecords.filter(
        record =>
          record.status === 'taken'
      ).length;

    const scheduled =
      selectedDayRecords.filter(
        record =>
          record.status === 'scheduled'
      ).length;

    const missed =
      selectedDayRecords.filter(
        record =>
          record.status === 'missed'
      ).length;

    return {
      total,
      taken,
      scheduled,
      missed,
    };
  }, [selectedDayRecords]);

  /*
   * --------------------------------------------------------
   * Month navigation
   * --------------------------------------------------------
   */

  function previousMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1
      )
    );
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      )
    );
  }

  function goToToday() {
    const today = new Date();

    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

    setSelectedDate(today);
  }

  function isToday(date: Date) {
    const today = new Date();

    return (
      date.getFullYear() ===
        today.getFullYear() &&
      date.getMonth() ===
        today.getMonth() &&
      date.getDate() ===
        today.getDate()
    );
  }

  function isSelected(date: Date) {
    return (
      formatDateKey(date) ===
      formatDateKey(selectedDate)
    );
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'taken':
        return 'Taken';

      case 'missed':
        return 'Missed';

      case 'skipped':
        return 'Skipped';

      case 'scheduled':
      default:
        return 'Scheduled';
    }
  }

  function statusClass(status: string) {
    switch (status) {
      case 'taken':
        return 'bg-green-100 text-green-700';

      case 'missed':
        return 'bg-red-100 text-red-700';

      case 'skipped':
        return 'bg-orange-100 text-orange-700';

      default:
        return 'bg-blue-100 text-blue-700';
    }
  }

  const monthTitle =
    currentMonth.toLocaleDateString(
      'en-US',
      {
        month: 'long',
        year: 'numeric',
      }
    );

  const selectedDateTitle =
    selectedDate.toLocaleDateString(
      'en-US',
      {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }
    );

  return (
    <div className="space-y-6">
      {/* Header */}

      <div>
        <h1 className="text-2xl font-semibold">
          Medication Monitoring
        </h1>

        <p className="mt-1 text-muted-foreground">
          Monitor medication schedules and dose activity
          for assigned patients.
        </p>
      </div>

      {/* Filters */}

      <div className="rounded-xl border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Patient
            </label>

            <select
              value={selectedPatientId}
              onChange={event =>
                setSelectedPatientId(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="all">
                All Patients
              </option>

              {patients.map(patient => (
                <option
                  key={patient.id}
                  value={patient.id}
                >
                  {patient.full_name}
                  {patient.patient_code
                    ? ` (${patient.patient_code})`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Dose Status
            </label>

            <select
              value={selectedStatus}
              onChange={event =>
                setSelectedStatus(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="all">
                All Statuses
              </option>

              <option value="taken">
                Taken
              </option>

              <option value="scheduled">
                Scheduled
              </option>

              <option value="missed">
                Missed
              </option>

              <option value="skipped">
                Skipped
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Calendar */}

      <div className="rounded-xl border bg-card">
        {/* Calendar header */}

        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">
              {monthTitle}
            </h2>

            <p className="text-sm text-muted-foreground">
              Select a date to review medication activity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={previousMonth}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            >
              ←
            </button>

            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            >
              Today
            </button>

            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            >
              →
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading medication calendar...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="p-5">
            {/* Weekdays */}

            <div className="grid grid-cols-7 border-l border-t">
              {[
                'Sun',
                'Mon',
                'Tue',
                'Wed',
                'Thu',
                'Fri',
                'Sat',
              ].map(day => (
                <div
                  key={day}
                  className="border-b border-r bg-muted/40 p-3 text-center text-xs font-semibold"
                >
                  {day}
                </div>
              ))}

              {/* Days */}

              {calendarDays.map(day => {
                const count =
                  doseCountByDate[
                    day.dateKey
                  ] ?? 0;

                return (
                  <button
                    type="button"
                    key={day.dateKey}
                    onClick={() =>
                      setSelectedDate(
                        day.date
                      )
                    }
                    className={`min-h-[90px] border-b border-r p-2 text-left transition hover:bg-muted/50 ${
                      !day.isCurrentMonth
                        ? 'text-muted-foreground/40'
                        : ''
                    } ${
                      isSelected(day.date)
                        ? 'bg-primary/5 ring-2 ring-inset ring-primary'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                          isToday(day.date)
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : ''
                        }`}
                      >
                        {day.date.getDate()}
                      </span>

                      {count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {count}
                        </span>
                      )}
                    </div>

                    {count > 0 && (
                      <div className="mt-3 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary" />

                        <span className="text-xs text-muted-foreground">
                          {count} dose
                          {count !== 1
                            ? 's'
                            : ''}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Date */}

      <div className="rounded-xl border bg-card">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">
            {selectedDateTitle}
          </h2>

          <p className="text-sm text-muted-foreground">
            Medication activity for the selected date.
          </p>
        </div>

        {/* Summary */}

        <div className="grid grid-cols-2 gap-4 border-b p-5 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Recorded Doses
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {selectedDaySummary.total}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Taken
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {selectedDaySummary.taken}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Scheduled
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {selectedDaySummary.scheduled}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Missed
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {selectedDaySummary.missed}
            </p>
          </div>
        </div>

        {/* Dose Records */}

        {selectedDayRecords.length === 0 &&
        selectedDaySchedules.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium">
              No medication activity
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              There are no recorded doses or active
              medication schedules for this date.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-5 py-3 font-medium">
                    Patient
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Medication
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Dose
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Scheduled
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Taken
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {selectedDayRecords.map(
                  record => (
                    <tr
                      key={record.id}
                      className="border-b last:border-0"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">
                          {getPatientName(
                            record.patient_id
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Patient #
                          {getPatientCode(
                            record.patient_id
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {record.medication_name}
                      </td>

                      <td className="px-5 py-4">
                        {record.dose ?? '—'}
                      </td>

                      <td className="px-5 py-4">
                        {new Date(
                          record.scheduled_at
                        ).toLocaleTimeString(
                          [],
                          {
                            hour: 'numeric',
                            minute: '2-digit',
                          }
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {record.taken_at
                          ? new Date(
                              record.taken_at
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: 'numeric',
                                minute: '2-digit',
                              }
                            )
                          : '—'}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                            record.status
                          )}`}
                        >
                          {statusLabel(
                            record.status
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                )}

                {/* Scheduled medications without
                    dose records */}

                {selectedDaySchedules
                  .filter(schedule => {
                    return !selectedDayRecords.some(
                      record =>
                        record.schedule_id ===
                        schedule.id
                    );
                  })
                  .map(schedule => (
                    <tr
                      key={`schedule-${schedule.id}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">
                          {getPatientName(
                            schedule.patient_id
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Patient #
                          {getPatientCode(
                            schedule.patient_id
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {schedule.medication_name}
                      </td>

                      <td className="px-5 py-4">
                        {schedule.dose}{' '}
                        {schedule.dose_unit ?? ''}
                      </td>

                      <td className="px-5 py-4">
                        {formatTime(
                          schedule.scheduled_time
                        )}
                      </td>

                      <td className="px-5 py-4">
                        —
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          Scheduled
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}