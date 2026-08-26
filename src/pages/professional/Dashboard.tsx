import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Pill,
  ArrowRight,
  MoreVertical,
  Activity,
} from 'lucide-react';

interface Patient {
  id: string;
  patient_code: string | null;
  full_name: string;
  sex: string | null;
  blood_group: string | null;
  updated_at: string;
}

interface DashboardPatient extends Patient {
  medicationCount: number;
  adherence: number;
  interactionCount: number;
  status: string;
  lastUpdated: string;
}

interface DoseRecord {
  id: string;
  patient_id: string;
  status: string;
  scheduled_at: string;
  taken_at: string | null;
}

interface MedicationSchedule {
  id: string;
  patient_id: string;
  medication_name: string;
}

interface InteractionAssessment {
  id: string;
  patient_id: string;
  severity: string;
  status: string;
  created_at: string;
}

export default function ProfessionalDashboard() {
  const { user, professionalProfile } = useAuth();

  const [patients, setPatients] = useState<DashboardPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalPatients: 0,
    averageAdherence: 0,
    interactionEvents: 0,
    medicationsTracked: 0,
  });

  useEffect(() => {
    async function loadDashboard() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        /*
         * assignments.professional_id stores the
         * Supabase auth user ID.
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

        console.log('Assignments:', assignments);

        const patientIds = (assignments ?? []).map(
          (assignment) => assignment.patient_id
        );

        console.log('Assigned patient IDs:', patientIds);

        if (patientIds.length === 0) {
          setPatients([]);

          setStats({
            totalPatients: 0,
            averageAdherence: 0,
            interactionEvents: 0,
            medicationsTracked: 0,
          });

          setLoading(false);
          return;
        }

        /*
         * Patient profiles
         */
        const { data: patientData, error: patientError } =
          await supabase
            .from('patient_profiles')
            .select(`
              id,
              patient_code,
              full_name,
              sex,
              blood_group,
              updated_at
            `)
            .in('id', patientIds);

        if (patientError) {
          throw patientError;
        }

        console.log('Patient data:', patientData);

        /*
         * Active medication schedules
         */
        const { data: medicationData, error: medicationError } =
          await supabase
            .from('medication_schedules')
            .select(`
              id,
              patient_id,
              medication_name
            `)
            .in('patient_id', patientIds)
            .eq('active', true);

        if (medicationError) {
          throw medicationError;
        }

        console.log(
          'Medication schedules:',
          medicationData
        );

        /*
         * Dose records
         */
        const { data: doseData, error: doseError } =
          await supabase
            .from('dose_records')
            .select(`
              id,
              patient_id,
              status,
              scheduled_at,
              taken_at
            `)
            .in('patient_id', patientIds);

        if (doseError) {
          throw doseError;
        }

        console.log('Dose records:', doseData);

        /*
         * Interaction assessments
         *
         * Currently this may return zero rows.
         * That is expected because the AI/interaction
         * functionality is being deferred for now.
         */
        const {
          data: interactionData,
          error: interactionError,
        } = await supabase
          .from('interaction_assessments')
          .select(`
            id,
            patient_id,
            severity,
            status,
            created_at
          `)
          .in('patient_id', patientIds);

        if (interactionError) {
          throw interactionError;
        }

        console.log(
          'Interaction assessments:',
          interactionData
        );

        /*
         * Build dashboard patient rows.
         */
        const dashboardPatients: DashboardPatient[] = (
          patientData ?? []
        ).map((patient) => {
          const medications = (
            medicationData ?? []
          ).filter(
            (medication) =>
              medication.patient_id === patient.id
          );

          const doses = (doseData ?? []).filter(
            (dose) => dose.patient_id === patient.id
          );

          const interactions = (
            interactionData ?? []
          ).filter(
            (interaction) =>
              interaction.patient_id === patient.id
          );

          /*
           * Adherence:
           *
           * taken doses / total recorded doses
           */
          const takenDoses = doses.filter(
            (dose) => dose.status === 'taken'
          ).length;

          const adherence =
            doses.length > 0
              ? Math.round(
                  (takenDoses / doses.length) * 100
                )
              : 0;

          /*
           * Status
           */
          let status = 'Needs Review';

          if (doses.length === 0) {
            status = 'Needs Review';
          } else if (adherence >= 90) {
            status = 'Excellent';
          } else if (adherence >= 80) {
            status = 'Good';
          } else {
            status = 'Needs Review';
          }

          /*
           * Find latest medication activity.
           */
          const latestDose = [...doses].sort(
            (a, b) =>
              new Date(
                b.taken_at ?? b.scheduled_at
              ).getTime() -
              new Date(
                a.taken_at ?? a.scheduled_at
              ).getTime()
          )[0];

          const lastUpdated =
            latestDose?.taken_at ??
            latestDose?.scheduled_at ??
            patient.updated_at;

          return {
            ...patient,
            medicationCount: medications.length,
            adherence,
            interactionCount: interactions.length,
            status,
            lastUpdated,
          };
        });

        /*
         * Dashboard totals
         */
        const totalPatients =
          dashboardPatients.length;

        const medicationsTracked =
          dashboardPatients.reduce(
            (total, patient) =>
              total + patient.medicationCount,
            0
          );

        const interactionEvents =
          dashboardPatients.reduce(
            (total, patient) =>
              total + patient.interactionCount,
            0
          );

        /*
         * Average adherence only considers
         * patients with recorded dose data.
         */
        const patientsWithDoseData =
          dashboardPatients.filter((patient) => {
            return (doseData ?? []).some(
              (dose) =>
                dose.patient_id === patient.id
            );
          });

        const averageAdherence =
          patientsWithDoseData.length > 0
            ? Math.round(
                patientsWithDoseData.reduce(
                  (total, patient) =>
                    total + patient.adherence,
                  0
                ) /
                  patientsWithDoseData.length
              )
            : 0;

        console.log(
          'Dashboard patients:',
          dashboardPatients
        );

        setPatients(dashboardPatients);

        setStats({
          totalPatients,
          averageAdherence,
          interactionEvents,
          medicationsTracked,
        });
      } catch (err) {
        console.error(
          'Failed to load professional dashboard:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load dashboard'
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [user]);

  /*
   * Professional initials
   */
  const professionalInitials =
    professionalProfile?.full_name
      ?.split(' ')
      .filter(Boolean)
      .map((name) => name[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? 'DR';

  /*
   * Greeting based on local browser time.
   */
  const currentHour = new Date().getHours();

  let greeting = 'Good morning';

  if (currentHour >= 12 && currentHour < 17) {
    greeting = 'Good afternoon';
  } else if (currentHour >= 17) {
    greeting = 'Good evening';
  }

  return (
    <div className="space-y-8">
      {/* =====================================================
          TOP HEADER
      ====================================================== */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, Healthcare Professional
          </h1>

          <p className="mt-1 text-muted-foreground">
            Medication, food-interaction and adherence
            overview
          </p>
        </div>

        {/* Professional profile */}
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
            {professionalInitials}
          </div>

          <div>
            <p className="text-sm font-semibold">
              {professionalProfile?.full_name ??
                'Healthcare Professional'}
            </p>

            <p className="text-xs text-muted-foreground">
              {professionalProfile?.professional_type ??
                'Professional'}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          MEDICATION MONITORING HEADER
      ====================================================== */}
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>

              <h2 className="text-xl font-semibold">
                Medication Monitoring
              </h2>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Real-time overview of patient medication
              adherence and interactions
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline"
          >
            Patient overview
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ====================================================== */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">
            Failed to load dashboard
          </p>

          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* =====================================================
          KPI CARDS
      ====================================================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Patients */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Total Patients
              </p>

              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {loading ? '—' : stats.totalPatients}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Active patients
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Average Adherence */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Avg. Adherence
              </p>

              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {loading
                  ? '—'
                  : `${stats.averageAdherence}%`}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Across patients with recorded doses
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950/40">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Interaction Events */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Interaction Events
              </p>

              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {loading
                  ? '—'
                  : stats.interactionEvents}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Recorded assessments
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-950/40">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Medications */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Medications Tracked
              </p>

              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {loading
                  ? '—'
                  : stats.medicationsTracked}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Active medication schedules
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40">
              <Pill className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          PATIENT OVERVIEW
      ====================================================== */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Patient Overview
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Medication adherence and interaction
                activity for assigned patients.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-4 w-4" />
              Live patient activity
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading patient activity...
          </div>
        ) : patients.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No assigned patients found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-5 py-3 font-medium">
                    Patient
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Medications
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Adherence
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Adherence Progress
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Interaction Events
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Status
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Last Updated
                  </th>

                  <th className="px-5 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="border-b transition-colors last:border-0 hover:bg-muted/30"
                  >
                    {/* Patient */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {patient.full_name
                            .split(' ')
                            .filter(Boolean)
                            .map((name) => name[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>

                        <div>
                          <div className="font-medium">
                            {patient.full_name}
                          </div>

                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Patient #
                            {patient.patient_code ?? '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Medications */}
                    <td className="px-5 py-4">
                      <span className="font-medium">
                        {patient.medicationCount}
                      </span>{' '}
                      <span className="text-muted-foreground">
                        {patient.medicationCount === 1
                          ? 'medication'
                          : 'medications'}
                      </span>
                    </td>

                    {/* Adherence */}
                    <td className="px-5 py-4">
                      <span className="font-semibold">
                        {patient.adherence}%
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{
                              width: `${patient.adherence}%`,
                            }}
                          />
                        </div>

                        <span className="text-xs text-muted-foreground">
                          {patient.adherence}%
                        </span>
                      </div>
                    </td>

                    {/* Interactions */}
                    <td className="px-5 py-4">
                      <span className="font-medium">
                        {patient.interactionCount}
                      </span>{' '}
                      <span className="text-muted-foreground">
                        {patient.interactionCount === 1
                          ? 'event'
                          : 'events'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          patient.status ===
                          'Excellent'
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                            : patient.status ===
                                'Good'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                        }`}
                      >
                        {patient.status}
                      </span>
                    </td>

                    {/* Last updated */}
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                      {new Date(
                        patient.lastUpdated
                      ).toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                        aria-label={`Actions for ${patient.full_name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          CURRENT DATA NOTE
          AI clinical insights intentionally omitted for now.
      ====================================================== */}
    </div>
  );
}