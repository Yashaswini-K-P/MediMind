import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  addSafetyReport,
  fetchSafetyReports,
  fetchMedicationSchedules,
} from '@/lib/api';
import type { SafetyReport, MedicationSchedule } from '@/types';

export default function SafetyReports() {
  const { patientProfile } = useAuth();
  const { show } = useToast();

  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [medications, setMedications] = useState<MedicationSchedule[]>([]);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [symptom, setSymptom] = useState('');
  const [severity, setSeverity] =
    useState<SafetyReport['severity']>('Mild');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');

  const [medicationExposure, setMedicationExposure] = useState('');
  const [foodExposure, setFoodExposure] = useState('');

  /*
   * Load reports and active medications.
   */
  const load = useCallback(async () => {
    if (!patientProfile) return;

    const [reportData, medicationData] = await Promise.all([
      fetchSafetyReports(patientProfile.id),
      fetchMedicationSchedules(patientProfile.id),
    ]);

    setReports(reportData);
    setMedications(medicationData);
  }, [patientProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Reset form when opening/closing.
   */
  const resetForm = () => {
    setSymptom('');
    setSeverity('Mild');
    setDuration('');
    setDescription('');
    setMedicationExposure('');
    setFoodExposure('');
  };

  const closeForm = () => {
    if (loading) return;
    resetForm();
    setOpen(false);
  };

  /*
   * Submit safety report.
   */
  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!patientProfile) {
      show('Unable to identify your patient profile.');
      return;
    }

    if (!symptom.trim()) {
      show('Please describe how you feel.');
      return;
    }

    setLoading(true);

    const row = await addSafetyReport(patientProfile.id, {
      symptom: symptom.trim(),
      severity,
      reported_at: new Date().toISOString(),
      medication_exposure: medicationExposure || null,
      food_exposure: foodExposure.trim() || null,
      duration: duration.trim() || null,
      repeated: false,
      description: description.trim() || null,
      status: 'Needs review',
    });

    setLoading(false);

    if (row) {
      show('Your report was recorded for review.');
      resetForm();
      setOpen(false);

      // Reload reports so the newly submitted report immediately
      // appears in the Recent reports section.
      await load();
    } else {
      show('Unable to record the report.');
    }
  };

  const severeCount = reports.filter(
    (report) => report.severity === 'Severe'
  ).length;

  /*
   * Format date similar to the client's design:
   * 24 Aug 2026 • 09:15 AM
   */
  const formatDate = (value: string) => {
    const date = new Date(value);

    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  /*
   * Build the exposure text shown below the symptom.
   */
  const getExposureText = (report: SafetyReport) => {
    if (report.medication_exposure) {
      return report.medication_exposure;
    }

    if (report.food_exposure) {
      return report.food_exposure;
    }

    return null;
  };

  return (
    <section className="page active">
      <div className="ss-simple">

        {/* =====================================================
            MAIN HEADER CARD
        ====================================================== */}
        <div className="card">
          <div className="ss-simple-head">

            <div className="ss-simple-title">
              <div className="ss-simple-icon">♥</div>

              <div>
                <h2>Symptoms &amp; Safety</h2>
                <p>
                  Tell us if you feel unwell after taking a medicine
                  or eating a food.
                </p>
              </div>
            </div>

            <button
              className="primary-btn ss-report-btn"
              onClick={() => {
                resetForm();
                setOpen(true);
              }}
              disabled={loading}
            >
              + Report a symptom
            </button>

          </div>

          {/* =================================================
              QUICK STATISTICS
          ================================================== */}
          <div className="ss-quick">

            <div className="ss-quick-item">
              <span>📋</span>

              <div>
                <b>{reports.length}</b>
                <small>Reports</small>
              </div>
            </div>

            <div className="ss-quick-item">
              <span>⚠️</span>

              <div>
                <b>{severeCount}</b>
                <small>Severe</small>
              </div>
            </div>

            <div className="ss-quick-note">
              <span>🛡️</span>

              <div>
                Reports help your healthcare professional review
                possible medicine or food-related problems.
              </div>
            </div>

          </div>

          {/* =================================================
              NEW REPORT FORM
          ================================================== */}
          {open && (
            <form className="card" onSubmit={submit}>

              <div className="card-header">
                <div>
                  <h2>Report a symptom</h2>

                  <p>
                    Keep it simple. Your healthcare professional
                    can review the details.
                  </p>
                </div>
              </div>

              <div className="form-grid">

                {/* Symptom */}
                <div className="field full">
                  <label>What are you feeling?</label>

                  <input
                    autoFocus
                    value={symptom}
                    onChange={(e) => setSymptom(e.target.value)}
                    placeholder="e.g. dizziness, nausea, headache"
                    disabled={loading}
                  />
                </div>

                {/* Severity */}
                <div className="field">
                  <label>How severe is it?</label>

                  <select
                    value={severity}
                    onChange={(e) =>
                      setSeverity(
                        e.target.value as SafetyReport['severity']
                      )
                    }
                    disabled={loading}
                  >
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </div>

                {/* Duration */}
                <div className="field">
                  <label>How long?</label>

                  <input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 2 hours"
                    disabled={loading}
                  />
                </div>

                {/* Medication exposure */}
                <div className="field">
                  <label>Did you recently take a medication?</label>

                  <select
                    value={medicationExposure}
                    onChange={(e) =>
                      setMedicationExposure(e.target.value)
                    }
                    disabled={loading}
                  >
                    <option value="">None / Not sure</option>

                    {medications.map((medication) => (
                      <option
                        key={medication.id}
                        value={`${medication.medication_name}${
                          medication.dose
                            ? ` ${medication.dose}`
                            : ''
                        }`}
                      >
                        {medication.medication_name}
                        {medication.dose
                          ? ` ${medication.dose}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Food exposure */}
                <div className="field">
                  <label>Did you recently eat something?</label>

                  <input
                    value={foodExposure}
                    onChange={(e) => setFoodExposure(e.target.value)}
                    placeholder="e.g. spinach, dairy, grapefruit"
                    disabled={loading}
                  />
                </div>

                {/* Description */}
                <div className="field full">
                  <label>
                    Anything else to tell your care team?
                  </label>

                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    placeholder="Optional context"
                    disabled={loading}
                  />
                </div>

              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <button
                  className="primary-btn"
                  style={{ width: 'auto' }}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit report'}
                </button>

                <button
                  className="secondary-btn"
                  type="button"
                  onClick={closeForm}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>

            </form>
          )}
        </div>

        {/* =====================================================
            RECENT REPORTS
        ====================================================== */}
        <div className="card">

          <div className="ss-section-head">
            <h3>Recent reports</h3>

            <span>Latest first</span>
          </div>

          {!reports.length ? (

            <div className="ss-empty">
              <span>✓</span>

              <div>
                <b>No reports yet</b>

                <p>
                  If something feels different, you can record it
                  here for your healthcare professional.
                </p>
              </div>
            </div>

          ) : (

            reports.map((report) => {
              const exposure = getExposureText(report);

              return (
                <div
                  className="ss-report-row"
                  key={report.id}
                >

                  {/* Icon */}
                  <div
                    className="ss-report-symbol"
                    aria-label={`${report.severity} report`}
                  >
                    {report.severity === 'Severe'
                      ? '!'
                      : report.severity === 'Moderate'
                      ? '•'
                      : '•'}
                  </div>

                  {/* Main content */}
                  <div className="ss-report-main">

                    <b>{report.symptom}</b>

                    <small>
                      {formatDate(report.reported_at)}

                      {exposure && (
                        <>
                          {' · '}
                          {exposure}
                        </>
                      )}
                    </small>

                    {report.description && (
                      <small>{report.description}</small>
                    )}

                  </div>

                  {/* Severity */}
                  <span
                    className={`badge ${
                      report.severity === 'Severe'
                        ? 'high'
                        : report.severity === 'Moderate'
                        ? 'moderate'
                        : 'low'
                    }`}
                  >
                    {report.severity}
                  </span>

                </div>
              );
            })

          )}

        </div>

        {/* =====================================================
            WHEN SHOULD YOU REPORT?
        ====================================================== */}
        <div className="ss-help">
          <span>ℹ️</span>

          <div>
            <b>When should you report?</b>

            <br />

            Report a new, unusual, worsening, or uncomfortable
            symptom.

            <br />

            For severe or emergency symptoms, seek medical care
            immediately.
          </div>
        </div>

      </div>
    </section>
  );
}