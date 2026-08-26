import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Assignment {
  patient_id: string;
}

interface Patient {
  id: string;
  full_name: string;
  patient_code: string | null;
}

interface SafetyReport {
  id: string;
  patient_id: string;
  symptom: string;
  description: string | null;
  severity: string | null;
  reported_at: string;
  medication_exposure: string | null;
  food_exposure: string | null;
  duration: string | null;
  repeated: boolean | null;
  status: string | null;
}

export default function ProfessionalSafetyReports() {
  const { user } = useAuth();

  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] =
    useState<SafetyReport | null>(null);

  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
   */

  useEffect(() => {
    if (!user) return;

    async function loadReports() {
      setLoading(true);
      setError(null);

      try {
        /*
         * Get active patient assignments for this professional.
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

        const patientIds = (
          (assignments ?? []) as Assignment[]
        ).map(
          (assignment) =>
            assignment.patient_id
        );

        if (patientIds.length === 0) {
          setPatients([]);
          setReports([]);
          setLoading(false);
          return;
        }

        /*
         * Load patient details.
         */
        const {
          data: patientData,
          error: patientError,
        } = await supabase
          .from('patient_profiles')
          .select(
            'id, full_name, patient_code'
          )
          .in('id', patientIds)
          .order('full_name', {
            ascending: true,
          });

        if (patientError) {
          throw patientError;
        }

        setPatients(
          (patientData ?? []) as Patient[]
        );

        /*
         * Load safety reports.
         */
        const {
          data: reportData,
          error: reportError,
        } = await supabase
          .from('safety_reports')
          .select(`
            id,
            patient_id,
            symptom,
            description,
            severity,
            reported_at,
            medication_exposure,
            food_exposure,
            duration,
            repeated,
            status
          `)
          .in('patient_id', patientIds)
          .order('reported_at', {
            ascending: false,
          });

        if (reportError) {
          throw reportError;
        }

        setReports(
          (reportData ?? []) as SafetyReport[]
        );
      } catch (err) {
        console.error(
          'Failed to load professional safety reports:',
          err
        );

        setReports([]);

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load safety reports.'
        );
      } finally {
        setLoading(false);
      }
    }

    void loadReports();
  }, [user]);

  /*
   * ============================================================
   * PATIENT LOOKUP
   * ============================================================
   */

  const getPatient = (
    patientId: string
  ) => {
    return patients.find(
      (patient) =>
        patient.id === patientId
    );
  };

  /*
   * ============================================================
   * SUMMARY
   * ============================================================
   */

  const repeatedCount = useMemo(() => {
    return reports.filter(
      (report) =>
        report.repeated === true
    ).length;
  }, [reports]);

  const openCount = useMemo(() => {
    return reports.filter(
      (report) => {
        const status =
          report.status
            ?.trim()
            .toLowerCase() || '';

        return (
          status === 'needs review' ||
          status === 'open' ||
          status === 'under review'
        );
      }
    ).length;
  }, [reports]);

  /*
   * ============================================================
   * DATE FORMAT
   * ============================================================
   */

  const formatDate = (
    value: string
  ) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }

    return date.toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    );
  };

  /*
   * ============================================================
   * STATUS
   * ============================================================
   */

  const getStatusClass = (
    status: string | null
  ) => {
    const value =
      status
        ?.trim()
        .toLowerCase() || '';

    if (
      value === 'under review'
    ) {
      return 'psr-status-review';
    }

    if (
      value === 'reviewed' ||
      value === 'closed'
    ) {
      return 'psr-status-reviewed';
    }

    return 'psr-status-open';
  };

  const getStatusLabel = (
    status: string | null
  ) => {
    if (!status?.trim()) {
      return 'Needs review';
    }

    return status;
  };

  /*
   * ============================================================
   * SEVERITY
   * ============================================================
   */

  const getSeverityClass = (
    severity: string | null
  ) => {
    const value =
      severity
        ?.trim()
        .toLowerCase() || 'mild';

    if (value === 'severe') {
      return 'psr-severity-severe';
    }

    if (value === 'moderate') {
      return 'psr-severity-moderate';
    }

    return 'psr-severity-mild';
  };

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div className="psr-page">

        <div className="psr-loading-card">

          <div className="psr-loading-icon">
            ⚕
          </div>

          <strong>
            Loading safety reports
          </strong>

          <span>
            Retrieving reports from assigned patients...
          </span>

        </div>

      </div>
    );
  }

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <div className="psr-page">

      {/* ======================================================
          PAGE HEADER
      ======================================================= */}

      <section className="psr-hero">

        <div className="psr-hero-content">

          <div className="psr-eyebrow">
            HUMAN-IN-THE-LOOP
          </div>

          <h2>
            Symptoms &amp; Safety Reports
          </h2>

          <p>
            Review patient-reported symptoms
            alongside medication and food
            exposure. Reports are signals for
            clinical assessment, not automatic
            ADR diagnoses.
          </p>

        </div>

        <div className="psr-clinical-badge">
          <span className="psr-clinical-icon">
            ⚕
          </span>

          <div>
            <strong>
              Human-in-the-loop
            </strong>

            <small>
              Clinical review required
            </small>
          </div>
        </div>

      </section>

      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (
        <div className="psr-error">
          <strong>
            Unable to load safety reports
          </strong>

          <span>
            {error}
          </span>
        </div>
      )}

      {/* ======================================================
          SUMMARY
      ======================================================= */}

      <section className="psr-summary">

        <div className="psr-summary-card">

          <div className="psr-summary-icon psr-summary-blue">
            ⚕
          </div>

          <div className="psr-summary-content">
            <strong>
              {reports.length}
            </strong>

            <span>
              Reports recorded
            </span>
          </div>

        </div>

        <div className="psr-summary-card">

          <div className="psr-summary-icon psr-summary-orange">
            🔁
          </div>

          <div className="psr-summary-content">
            <strong>
              {repeatedCount}
            </strong>

            <span>
              Repeated symptoms
            </span>
          </div>

        </div>

        <div className="psr-summary-card">

          <div className="psr-summary-icon psr-summary-red">
            🔎
          </div>

          <div className="psr-summary-content">
            <strong>
              {openCount}
            </strong>

            <span>
              Open for review
            </span>
          </div>

        </div>

      </section>

      {/* ======================================================
          REPORT TABLE
      ======================================================= */}

      <section className="psr-card">

        <div className="psr-section-header">

          <div>

            <h3>
              Patient Safety Reports
            </h3>

            <p>
              Review reported symptoms and
              relevant medication or food
              exposure.
            </p>

          </div>

          <div className="psr-report-count">
            {reports.length}{' '}
            {reports.length === 1
              ? 'report'
              : 'reports'}
          </div>

        </div>

        {!reports.length ? (

          <div className="psr-empty">

            <div className="psr-empty-icon">
              ✓
            </div>

            <div>
              <strong>
                No safety reports
              </strong>

              <p>
                No patient-reported symptoms
                are currently available for
                your assigned patients.
              </p>
            </div>

          </div>

        ) : (

          <div className="psr-table-scroll">

            <table className="psr-table">

              <thead>

                <tr>

                  <th>
                    Report
                  </th>

                  <th>
                    Symptom
                  </th>

                  <th>
                    Medication exposure
                  </th>

                  <th>
                    Food exposure
                  </th>

                  <th>
                    Timing
                  </th>

                  <th>
                    Severity
                  </th>

                  <th>
                    Repeated
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Review
                  </th>

                </tr>

              </thead>

              <tbody>

                {reports.map(
                  (report) => {

                    const patient =
                      getPatient(
                        report.patient_id
                      );

                    return (
                      <tr
                        key={report.id}
                      >

                        {/* Report */}

                        <td>

                          <div className="psr-report-cell">

                            <strong>
                              {report.id
                                .slice(0, 10)
                                .toUpperCase()}
                            </strong>

                            <span>
                              {formatDate(
                                report.reported_at
                              )}
                            </span>

                            {patient && (
                              <small>
                                {patient.full_name}
                                {patient.patient_code
                                  ? ` • ${patient.patient_code}`
                                  : ''}
                              </small>
                            )}

                          </div>

                        </td>

                        {/* Symptom */}

                        <td>

                          <div className="psr-symptom-cell">

                            <strong>
                              {report.symptom}
                            </strong>

                            {report.description && (
                              <span>
                                {report.description}
                              </span>
                            )}

                          </div>

                        </td>

                        {/* Medication */}

                        <td>

                          {report.medication_exposure ? (

                            <div className="psr-exposure-cell">

                              <strong>
                                {report.medication_exposure}
                              </strong>

                              <span>
                                Medication exposure
                              </span>

                            </div>

                          ) : (

                            <span className="psr-muted">
                              None recorded
                            </span>

                          )}

                        </td>

                        {/* Food */}

                        <td>

                          {report.food_exposure ? (

                            <div className="psr-exposure-cell">

                              <strong>
                                {report.food_exposure}
                              </strong>

                              <span>
                                Recorded food exposure
                              </span>

                            </div>

                          ) : (

                            <span className="psr-muted">
                              None recorded
                            </span>

                          )}

                        </td>

                        {/* Timing */}

                        <td>

                          <span className="psr-timing">
                            {report.duration ||
                              '—'}
                          </span>

                        </td>

                        {/* Severity */}

                        <td>

                          <span
                            className={`psr-severity ${getSeverityClass(
                              report.severity
                            )}`}
                          >
                            {report.severity ||
                              'Mild'}
                          </span>

                        </td>

                        {/* Repeated */}

                        <td>

                          {report.repeated ? (

                            <span className="psr-repeated">
                              Yes
                            </span>

                          ) : (

                            <span className="psr-not-repeated">
                              No
                            </span>

                          )}

                        </td>

                        {/* Status */}

                        <td>

                          <span
                            className={`psr-status ${getStatusClass(
                              report.status
                            )}`}
                          >
                            {getStatusLabel(
                              report.status
                            )}
                          </span>

                        </td>

                        {/* Review */}

                        <td>

                          <button
                            type="button"
                            className="psr-review-button"
                            onClick={() =>
                              setSelectedReport(
                                report
                              )
                            }
                          >
                            Review
                          </button>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

      {/* ======================================================
          CLINICAL REVIEW CONTEXT
      ======================================================= */}

      <section className="psr-card">

        <div className="psr-section-header">

          <div>

            <h3>
              Clinical review context
            </h3>

            <p>
              Do not infer causality automatically.
            </p>

          </div>

        </div>

        <div className="psr-context-grid">

          <ContextCard
            icon="💊"
            title="Medication relationship"
            text="Review the dose, administration time, recent dose changes, and whether the symptom recurs after exposure."
          />

          <ContextCard
            icon="🍽️"
            title="Food relationship"
            text="Check the food recorded around the dose and whether a validated drug-food interaction was detected."
          />

          <ContextCard
            icon="◷"
            title="Temporal relationship"
            text="Compare symptom onset with medication and food timestamps. Timing supports assessment but does not establish causality."
          />

          <ContextCard
            icon="🔁"
            title="Repeated exposure"
            text="Repeated symptoms following similar exposures may provide a stronger signal for professional review."
          />

        </div>

      </section>

      {/* ======================================================
          REVIEW MODAL
      ======================================================= */}

      {selectedReport && (

        <div
          className="psr-modal-backdrop"
          onClick={() =>
            setSelectedReport(null)
          }
        >

          <div
            className="psr-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="psr-modal-header">

              <div>

                <span>
                  SAFETY REPORT
                </span>

                <h3>
                  {selectedReport.symptom}
                </h3>

                <small>
                  {formatDate(
                    selectedReport.reported_at
                  )}
                </small>

              </div>

              <button
                type="button"
                className="psr-close"
                onClick={() =>
                  setSelectedReport(null)
                }
                aria-label="Close review"
              >
                ×
              </button>

            </div>

            <div className="psr-modal-patient">

              <span>
                Patient
              </span>

              <strong>
                {getPatient(
                  selectedReport.patient_id
                )?.full_name ||
                  'Unknown patient'}
              </strong>

              {getPatient(
                selectedReport.patient_id
              )?.patient_code && (
                <span>
                  #
                  {getPatient(
                    selectedReport.patient_id
                  )?.patient_code}
                </span>
              )}

            </div>

            <div className="psr-modal-grid">

              <Detail
                label="Severity"
                value={
                  selectedReport.severity ||
                  'Mild'
                }
              />

              <Detail
                label="Repeated"
                value={
                  selectedReport.repeated
                    ? 'Yes'
                    : 'No'
                }
              />

              <Detail
                label="Status"
                value={
                  getStatusLabel(
                    selectedReport.status
                  )
                }
              />

              <Detail
                label="Timing"
                value={
                  selectedReport.duration ||
                  'Not recorded'
                }
              />

              <Detail
                label="Medication exposure"
                value={
                  selectedReport.medication_exposure ||
                  'None recorded'
                }
              />

              <Detail
                label="Food exposure"
                value={
                  selectedReport.food_exposure ||
                  'None recorded'
                }
              />

            </div>

            {selectedReport.description && (

              <div className="psr-modal-description">

                <strong>
                  Patient description
                </strong>

                <p>
                  {selectedReport.description}
                </p>

              </div>

            )}

            <div className="psr-modal-warning">

              <span>
                ⚠
              </span>

              <p>
                This report is a clinical
                signal. It does not establish
                that a medication or food
                caused the symptom.
              </p>

            </div>

            <div className="psr-modal-actions">

              <button
                type="button"
                className="psr-modal-close-button"
                onClick={() =>
                  setSelectedReport(null)
                }
              >
                Close review
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

/* ============================================================
   CONTEXT CARD
============================================================ */

function ContextCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="psr-context-card">

      <div className="psr-context-icon">
        {icon}
      </div>

      <div>

        <h4>
          {title}
        </h4>

        <p>
          {text}
        </p>

      </div>

    </div>
  );
}

/* ============================================================
   DETAIL
============================================================ */

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="psr-detail">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}