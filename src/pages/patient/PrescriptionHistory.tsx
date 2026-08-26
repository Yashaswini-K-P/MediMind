import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createPrescription, fetchPrescriptionLines, fetchPrescriptions } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import type { Prescription, PrescriptionLine } from '@/types';

interface MedicationForm {
  medication_name: string;
  dose: string;
  dose_unit: string;
  frequency: string;
  route: string;

  /*
   * Structured guidance
   */
  scheduled_times: string[];
  food_instruction: string;
  administration_instruction: string;

  start_date: string;
  end_date: string;
}

const emptyMedication = (): MedicationForm => ({
  medication_name: '',
  dose: '',
  dose_unit: 'mg',
  frequency: 'Once daily',
  route: 'Oral',
  scheduled_times: ['09:00'],
  food_instruction: '',
  administration_instruction: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
});

export default function PrescriptionHistory() {
  const { patientProfile } = useAuth();
  const { show } = useToast();

  const [items, setItems] = useState<
    Array<{
      prescription: Prescription;
      lines: PrescriptionLine[];
    }>
  >([]);

  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<MedicationForm[]>([
    emptyMedication(),
  ]);

  /* =========================================================
     LOAD PRESCRIPTIONS
     ========================================================= */

  const loadPrescriptions = async () => {
    if (!patientProfile) return;

    setLoading(true);

    const prescriptions = await fetchPrescriptions(
      patientProfile.id
    );

    const rows = await Promise.all(
      prescriptions.map(async prescription => ({
        prescription,
        lines: await fetchPrescriptionLines(
          prescription.id
        ),
      }))
    );

    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    void loadPrescriptions();
  }, [patientProfile]);

  /* =========================================================
     MEDICATION FORM HELPERS
     ========================================================= */

  const updateMedication = (
    index: number,
    field: keyof MedicationForm,
    value: string | string[]
  ) => {
    setMedications(current =>
      current.map((med, i) =>
        i === index
          ? {
              ...med,
              [field]: value,
            }
          : med
      )
    );
  };

  const addMedication = () => {
    setMedications(current => [
      ...current,
      emptyMedication(),
    ]);
  };

  const removeMedication = (index: number) => {
    setMedications(current => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((_, i) => i !== index);
    });
  };

  /* =========================================================
     TIME HELPERS
     ========================================================= */

  const addTime = (medIndex: number) => {
    setMedications(current =>
      current.map((med, index) => {
        if (index !== medIndex) return med;

        return {
          ...med,
          scheduled_times: [
            ...med.scheduled_times,
            '21:00',
          ],
        };
      })
    );
  };

  const updateTime = (
    medIndex: number,
    timeIndex: number,
    value: string
  ) => {
    setMedications(current =>
      current.map((med, index) => {
        if (index !== medIndex) return med;

        return {
          ...med,
          scheduled_times: med.scheduled_times.map(
            (time, i) =>
              i === timeIndex ? value : time
          ),
        };
      })
    );
  };

  const removeTime = (
    medIndex: number,
    timeIndex: number
  ) => {
    setMedications(current =>
      current.map((med, index) => {
        if (index !== medIndex) return med;

        if (med.scheduled_times.length === 1) {
          return med;
        }

        return {
          ...med,
          scheduled_times:
            med.scheduled_times.filter(
              (_, i) => i !== timeIndex
            ),
        };
      })
    );
  };

  /* =========================================================
     SAVE PRESCRIPTION
     ========================================================= */

  const savePrescription = async () => {
    if (!patientProfile) {
      show('Patient profile not found.');
      return;
    }

    const validMedications = medications.filter(
      medication =>
        medication.medication_name.trim() &&
        medication.dose.trim()
    );

    if (!validMedications.length) {
      show(
        'Enter at least one medication with its dose.'
      );
      return;
    }

    /*
     * Convert our UI model into the API model.
     */
    const lines = validMedications.map(medication => ({
      medication_name:
        medication.medication_name.trim(),

      dose: medication.dose.trim(),

      dose_unit:
        medication.dose_unit.trim() || null,

      frequency:
        medication.frequency.trim() ||
        'As prescribed',

      route:
        medication.route.trim() || null,

      /*
       * Keep this for prescription history.
       */
      instructions:
        medication.administration_instruction.trim() ||
        null,

      administration_with_food:
        medication.food_instruction.trim() ||
        null,

      /*
       * These are used to create medication schedules.
       */
      scheduled_times:
        medication.scheduled_times.length
          ? medication.scheduled_times
          : ['09:00'],

      start_date:
        medication.start_date || null,

      end_date:
        medication.end_date || null,

      food_instruction:
        medication.food_instruction.trim() ||
        null,

      administration_instruction:
        medication.administration_instruction.trim() ||
        null,
    }));

    const saved = await createPrescription(
      patientProfile.id,
      'manual',
      notes.trim(),
      lines
    );

    if (!saved) {
      show('Unable to save prescription.');
      return;
    }

    show(
      'Prescription saved and medication schedule created.'
    );

    setMedications([emptyMedication()]);
    setNotes('');
    setManualOpen(false);

    await loadPrescriptions();
  };

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div className="empty">
        Loading prescription history...
      </div>
    );
  }

  /* =========================================================
     UI
     ========================================================= */

  return (
    <section className="page active">
      <div className="card">

        {/* =================================================
            HEADER
            ================================================= */}

        <div className="card-header">
          <div>
            <h2>Prescription History</h2>

            <p>
              Prescription records linked to your
              medication regimen.
            </p>
          </div>

          <button
            className="primary-btn"
            style={{ width: 'auto' }}
            onClick={() =>
              setManualOpen(value => !value)
            }
          >
            {manualOpen
              ? 'Close'
              : 'Enter prescription'}
          </button>
        </div>

        {/* =================================================
            STRUCTURED PRESCRIPTION FORM
            ================================================= */}

        {manualOpen && (
          <div
            className="card"
            style={{
              background: 'var(--bg)',
              marginBottom: 20,
            }}
          >
            <div className="card-header">
              <div>
                <h2>Enter prescription</h2>

                <p>
                  Add the medication, schedule, food
                  guidance and administration instructions.
                </p>
              </div>
            </div>

            {/* =============================================
                MEDICATIONS
                ============================================= */}

            {medications.map((medication, index) => (
              <div
                key={index}
                className="card"
                style={{
                  marginBottom: 16,
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <strong>
                      Medication {index + 1}
                    </strong>

                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginTop: 4,
                      }}
                    >
                      This information will also appear
                      in Medication Management.
                    </div>
                  </div>

                  {medications.length > 1 && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        removeMedication(index)
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* =========================================
                    MEDICATION NAME
                    ========================================= */}

                <div className="form-grid">
                  <div className="field">
                    <label>
                      Medication name
                    </label>

                    <input
                      value={
                        medication.medication_name
                      }
                      onChange={e =>
                        updateMedication(
                          index,
                          'medication_name',
                          e.target.value
                        )
                      }
                      placeholder="e.g. Metformin"
                    />
                  </div>

                  {/* =======================================
                      DOSE
                      ======================================= */}

                  <div className="field">
                    <label>Dose</label>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <input
                        style={{ flex: 1 }}
                        value={medication.dose}
                        onChange={e =>
                          updateMedication(
                            index,
                            'dose',
                            e.target.value
                          )
                        }
                        placeholder="500"
                      />

                      <select
                        style={{
                          width: 100,
                          padding: '11px 10px',
                          border:
                            '1px solid var(--border)',
                          borderRadius:
                            'var(--radius-sm)',
                          fontFamily: 'inherit',
                        }}
                        value={
                          medication.dose_unit
                        }
                        onChange={e =>
                          updateMedication(
                            index,
                            'dose_unit',
                            e.target.value
                          )
                        }
                      >
                        <option value="mg">
                          mg
                        </option>
                        <option value="mcg">
                          mcg
                        </option>
                        <option value="g">
                          g
                        </option>
                        <option value="mL">
                          mL
                        </option>
                        <option value="units">
                          units
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* =======================================
                      FREQUENCY
                      ======================================= */}

                  <div className="field">
                    <label>Frequency</label>

                    <select
                      value={
                        medication.frequency
                      }
                      onChange={e =>
                        updateMedication(
                          index,
                          'frequency',
                          e.target.value
                        )
                      }
                    >
                      <option>
                        Once daily
                      </option>

                      <option>
                        Twice daily
                      </option>

                      <option>
                        Three times daily
                      </option>

                      <option>
                        Four times daily
                      </option>

                      <option>
                        Every 8 hours
                      </option>

                      <option>
                        Every 12 hours
                      </option>

                      <option>
                        As needed
                      </option>

                      <option>
                        As prescribed
                      </option>
                    </select>
                  </div>

                  {/* =======================================
                      ROUTE
                      ======================================= */}

                  <div className="field">
                    <label>Route</label>

                    <select
                      value={medication.route}
                      onChange={e =>
                        updateMedication(
                          index,
                          'route',
                          e.target.value
                        )
                      }
                    >
                      <option>
                        Oral
                      </option>

                      <option>
                        Topical
                      </option>

                      <option>
                        Inhalation
                      </option>

                      <option>
                        Injection
                      </option>

                      <option>
                        Other
                      </option>
                    </select>
                  </div>

                  {/* =======================================
                      START DATE
                      ======================================= */}

                  <div className="field">
                    <label>Start date</label>

                    <input
                      type="date"
                      value={
                        medication.start_date
                      }
                      onChange={e =>
                        updateMedication(
                          index,
                          'start_date',
                          e.target.value
                        )
                      }
                    />
                  </div>

                  {/* =======================================
                      END DATE
                      ======================================= */}

                  <div className="field">
                    <label>
                      End date
                      <span
                        style={{
                          fontWeight: 400,
                          color:
                            'var(--text-muted)',
                        }}
                      >
                        {' '}
                        (optional)
                      </span>
                    </label>

                    <input
                      type="date"
                      value={
                        medication.end_date
                      }
                      onChange={e =>
                        updateMedication(
                          index,
                          'end_date',
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>

                {/* =========================================
                    SCHEDULED TIMES
                    ========================================= */}

                <div
                  style={{
                    marginTop: 8,
                    marginBottom: 18,
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginBottom: 8,
                    }}
                  >
                    Medication times
                  </label>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    {medication.scheduled_times.map(
                      (time, timeIndex) => (
                        <div
                          key={timeIndex}
                          style={{
                            display: 'flex',
                            gap: 4,
                            alignItems: 'center',
                          }}
                        >
                          <input
                            type="time"
                            value={time}
                            onChange={e =>
                              updateTime(
                                index,
                                timeIndex,
                                e.target.value
                              )
                            }
                            style={{
                              padding:
                                '9px 10px',
                              border:
                                '1px solid var(--border)',
                              borderRadius:
                                'var(--radius-sm)',
                            }}
                          />

                          {medication
                            .scheduled_times
                            .length > 1 && (
                            <button
                              type="button"
                              className="secondary-btn"
                              style={{
                                padding:
                                  '7px 9px',
                              }}
                              onClick={() =>
                                removeTime(
                                  index,
                                  timeIndex
                                )
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )
                    )}

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        addTime(index)
                      }
                    >
                      + Add time
                    </button>
                  </div>
                </div>

                {/* =========================================
                    FOOD GUIDANCE
                    ========================================= */}

                <div className="field">
                  <label>
                    Food guidance
                  </label>

                  <select
                    value={
                      medication.food_instruction
                    }
                    onChange={e =>
                      updateMedication(
                        index,
                        'food_instruction',
                        e.target.value
                      )
                    }
                  >
                    <option value="">
                      No specific food instruction
                    </option>

                    <option>
                      Before food
                    </option>

                    <option>
                      With food
                    </option>

                    <option>
                      After food
                    </option>

                    <option>
                      On an empty stomach
                    </option>

                    <option>
                      With or without food
                    </option>
                  </select>
                </div>

                {/* =========================================
                    ADMINISTRATION GUIDANCE
                    ========================================= */}

                <div className="field">
                  <label>
                    Administration instructions
                  </label>

                  <textarea
                    rows={3}
                    value={
                      medication.administration_instruction
                    }
                    onChange={e =>
                      updateMedication(
                        index,
                        'administration_instruction',
                        e.target.value
                      )
                    }
                    placeholder="e.g. Take with a full glass of water. Do not crush or chew."
                  />
                </div>
              </div>
            ))}

            {/* =============================================
                ADD ANOTHER MEDICATION
                ============================================= */}

            <button
              type="button"
              className="secondary-btn"
              onClick={addMedication}
              style={{
                marginBottom: 18,
              }}
            >
              + Add another medication
            </button>

            {/* =============================================
                PRESCRIPTION NOTES
                ============================================= */}

            <div className="field">
              <label>
                Prescription notes
              </label>

              <textarea
                rows={3}
                value={notes}
                onChange={e =>
                  setNotes(e.target.value)
                }
                placeholder="Optional notes from the prescription"
              />
            </div>

            {/* =============================================
                ACTIONS
                ============================================= */}

            <div
              style={{
                display: 'flex',
                gap: 10,
              }}
            >
              <button
                className="primary-btn"
                style={{ width: 'auto' }}
                type="button"
                onClick={savePrescription}
              >
                Save prescription
              </button>

              <button
                className="secondary-btn"
                type="button"
                onClick={() => {
                  setManualOpen(false);
                  setMedications([
                    emptyMedication(),
                  ]);
                  setNotes('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* =================================================
            PRESCRIPTION HISTORY
            ================================================= */}

        {!items.length ? (
          <div className="empty">
            No prescription history is available yet.
          </div>
        ) : (
          items.map(
            ({ prescription, lines }) => (
              <div
                className="prescription-card"
                key={prescription.id}
              >
                <div className="card-header">
                  <div>
                    <strong>
                      {new Date(
                        prescription.prescription_date
                      ).toLocaleDateString()}
                    </strong>

                    <p>
                      {prescription.source} ·{' '}
                      {prescription.status}
                    </p>
                  </div>

                  <span className="badge neutral">
                    {prescription.start_date ||
                      'Start date not recorded'}
                  </span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Dose</th>
                        <th>Frequency</th>
                        <th>Route</th>
                        <th>Food guidance</th>
                        <th>Instructions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {lines.map(line => (
                        <tr key={line.id}>
                          <td>
                            <strong>
                              {
                                line.medication_name
                              }
                            </strong>
                          </td>

                          <td>
                            {line.dose}{' '}
                            {line.dose_unit ||
                              ''}
                          </td>

                          <td>
                            {line.frequency ||
                              '—'}
                          </td>

                          <td>
                            {line.route ||
                              '—'}
                          </td>

                          <td>
                            {line
                              .administration_with_food ||
                              '—'}
                          </td>

                          <td>
                            {line.instructions ||
                              '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {prescription.notes && (
                  <div className="calendar-detail">
                    <strong>
                      Notes:
                    </strong>{' '}
                    {prescription.notes}
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}