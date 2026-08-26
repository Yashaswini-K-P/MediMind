import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';

import Login from '@/pages/Login';

// ============================================================
// PATIENT PAGES
// ============================================================

import PatientHome from '@/pages/patient/Home';
import PatientProfilePage from '@/pages/patient/Profile';
import MedicationManagement from '@/pages/patient/Medications';
import FoodInteractions from '@/pages/patient/FoodInteractions';
import PrescriptionHistory from '@/pages/patient/PrescriptionHistory';
import SafetyReports from '@/pages/patient/SafetyReports';
import PersonalizedGuidance from '@/pages/patient/Guidance';
import Settings from '@/pages/patient/Settings';

// ============================================================
// PROFESSIONAL PAGES
// ============================================================

import ProfessionalDashboard from '@/pages/professional/Dashboard';
import MedicationMonitoring from '@/pages/professional/MedicationMonitoring';
import SafetyMonitoring from '@/pages/professional/SafetyMonitoring';
import ProfessionalPatient from '@/pages/professional/Patient';

// ============================================================
// VIEW TYPES
// ============================================================

type View =
  | 'home'
  | 'profile'
  | 'medications'
  | 'food'
  | 'prescriptions'
  | 'safety'
  | 'guidance'
  | 'settings'
  | 'professional'
  | 'professional-medications'
  | 'professional-safety';

// ============================================================
// APP
// ============================================================

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ToastProvider>
  );
}

// ============================================================
// AUTHENTICATED APP
// ============================================================

function AuthenticatedApp() {
  const {
    session,
    loading,
    profile,
    patientProfile,
    professionalProfile,
    signOut,
  } = useAuth();

  // ----------------------------------------------------------
  // CURRENT VIEW
  // ----------------------------------------------------------

  const [view, setView] = useState<View>('home');

  // ----------------------------------------------------------
  // SELECTED PATIENT
  // Used when a professional opens a patient from dashboard.
  // ----------------------------------------------------------

  const [selectedPatientId, setSelectedPatientId] =
    useState<string | null>(null);

  // ----------------------------------------------------------
  // DARK MODE
  // ----------------------------------------------------------

  const [dark, setDark] = useState(
    () =>
      localStorage.getItem('medimind-theme') === 'dark'
  );

  // ----------------------------------------------------------
  // FONT SCALE
  // ----------------------------------------------------------

  const [fontScale, setFontScale] = useState(
    () =>
      Number(
        localStorage.getItem(
          'medimind-font-scale'
        ) || 100
      )
  );

  // ==========================================================
  // THEME
  // ==========================================================

  useEffect(() => {
    document.body.classList.toggle(
      'dark-theme',
      dark
    );

    localStorage.setItem(
      'medimind-theme',
      dark ? 'dark' : 'light'
    );
  }, [dark]);

  // ==========================================================
  // FONT SCALE
  // ==========================================================

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--medimind-font-scale',
      String(fontScale / 100)
    );

    localStorage.setItem(
      'medimind-font-scale',
      String(fontScale)
    );
  }, [fontScale]);

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="loading-screen">
        Loading MediMind...
      </div>
    );
  }

  // ==========================================================
  // NOT LOGGED IN
  // ==========================================================

  if (!session) {
    return <Login />;
  }

  // ==========================================================
  // DETERMINE ROLE
  // ==========================================================

  const role =
    profile?.role ||
    (professionalProfile
      ? 'professional'
      : 'patient');

  const isProfessional =
    role === 'professional' ||
    role === 'admin';

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const go = (next: View) => {
    /*
     * Clear a previously selected professional patient
     * whenever the user changes the main page.
     *
     * Medication Monitoring and Symptoms & Safety have
     * their own patient selectors.
     */
    setSelectedPatientId(null);
    setView(next);
  };

  // ==========================================================
  // OPEN PATIENT FROM PROFESSIONAL DASHBOARD
  // ==========================================================

  const openPatient = (id: string) => {
    setSelectedPatientId(id);
    setView('professional');
  };

  // ==========================================================
  // DISPLAY NAME
  // ==========================================================

  const displayName = isProfessional
    ? professionalProfile?.full_name ||
      'Healthcare Professional'
    : patientProfile?.full_name ||
      'Patient';

  // ==========================================================
  // APP LAYOUT
  // ==========================================================

  return (
    <div className="app">

      {/* ====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">

        {/* --------------------------------------------------
            LOGO
        -------------------------------------------------- */}

        <div className="sidebar-logo">

          <div className="logo">
            Medi<span>Mind</span>
          </div>

          <div className="tagline">
            Medication &amp; Food Intelligence
          </div>

        </div>

        {/* --------------------------------------------------
            USER ROLE
        -------------------------------------------------- */}

        <div className="sidebar-role">

          <b>
            {displayName}
          </b>

          <span>
            {isProfessional
              ? 'Healthcare Professional'
              : 'Patient account'}
          </span>

        </div>

        {/* ==================================================
            NAVIGATION
        ================================================== */}

        <nav>

          {/* =================================================
              PROFESSIONAL NAVIGATION
          ================================================= */}

          {isProfessional ? (
            <>

              {/* ---------------------------------------------
                  PROFESSIONAL DASHBOARD
              --------------------------------------------- */}

              <NavItem
                label="Professional Dashboard"
                active={
                  view === 'professional' &&
                  !selectedPatientId
                }
                onClick={() =>
                  go('professional')
                }
              />

              {/* ---------------------------------------------
                  MEDICATION MONITORING
              --------------------------------------------- */}

              <NavItem
                label="Medication Monitoring"
                active={
                  view ===
                  'professional-medications'
                }
                onClick={() =>
                  go(
                    'professional-medications'
                  )
                }
              />

              {/* ---------------------------------------------
                  SYMPTOMS & SAFETY
              --------------------------------------------- */}

              <NavItem
                label="Symptoms & Safety"
                active={
                  view ===
                  'professional-safety'
                }
                onClick={() =>
                  go(
                    'professional-safety'
                  )
                }
              />

            </>
          ) : (

            /* =================================================
               PATIENT NAVIGATION
            ================================================= */

            <>

              {/* ---------------------------------------------
                  HOME
              --------------------------------------------- */}

              <NavItem
                label="Home"
                active={
                  view === 'home'
                }
                onClick={() =>
                  go('home')
                }
              />

              {/* ---------------------------------------------
                  PATIENT PROFILE
              --------------------------------------------- */}

              <NavItem
                label="Patient Profile"
                active={
                  view === 'profile'
                }
                onClick={() =>
                  go('profile')
                }
              />

              {/* ---------------------------------------------
                  MEDICATION MANAGEMENT
              --------------------------------------------- */}

              <NavItem
                label="Medication Management"
                active={
                  view === 'medications'
                }
                onClick={() =>
                  go('medications')
                }
              />

              {/* ---------------------------------------------
                  FOOD & INTERACTIONS
              --------------------------------------------- */}

              <NavItem
                label="Food & Interactions"
                active={
                  view === 'food'
                }
                onClick={() =>
                  go('food')
                }
              />

              {/* ---------------------------------------------
                  PRESCRIPTION HISTORY
              --------------------------------------------- */}

              <NavItem
                label="Prescription History"
                active={
                  view === 'prescriptions'
                }
                onClick={() =>
                  go('prescriptions')
                }
              />

              {/* ---------------------------------------------
                  HOW YOU FEEL
              --------------------------------------------- */}

              <NavItem
                label="How You Feel"
                active={
                  view === 'safety'
                }
                onClick={() =>
                  go('safety')
                }
              />

              {/* ---------------------------------------------
                  PERSONALIZED GUIDANCE
              --------------------------------------------- */}

              <NavItem
                label="Personalized Guidance"
                active={
                  view === 'guidance'
                }
                onClick={() =>
                  go('guidance')
                }
              />

              {/* ---------------------------------------------
                  SETTINGS
              --------------------------------------------- */}

              <NavItem
                label="Settings"
                active={
                  view === 'settings'
                }
                onClick={() =>
                  go('settings')
                }
              />

            </>
          )}

        </nav>

        {/* ==================================================
            SIGN OUT
        ================================================== */}

        <button
          className="logout"
          onClick={() => signOut()}
        >
          Sign out
        </button>

      </aside>

      {/* ====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="main">

        {/* ==================================================
            TOP BAR
        ================================================== */}

        <header className="topbar">

          {/* ------------------------------------------------
              PAGE TITLE
          ------------------------------------------------ */}

          <div className="welcome">

            <h1>
              {getTitle(
                view,
                selectedPatientId,
                isProfessional
              )}
            </h1>

            <p>
              {isProfessional
                ? 'Review assigned patients, adherence and validated food-drug interaction evidence.'
                : 'Your medication, food and safety information in one place.'}
            </p>

          </div>

          {/* ------------------------------------------------
              TOP ACTIONS
          ------------------------------------------------ */}

          <div className="top-actions">

            {/* ----------------------------------------------
                THEME BUTTON
            ---------------------------------------------- */}

            <button
              className="secondary-btn"
              onClick={() =>
                setDark((value) => !value)
              }
            >
              {dark
                ? 'Light theme'
                : 'Dark theme'}
            </button>

            {/* ----------------------------------------------
                PROFILE
            ---------------------------------------------- */}

            <div className="profile">

              <div>

                <strong>
                  {displayName}
                </strong>

                <small>
                  {isProfessional
                    ? 'Professional'
                    : 'Patient'}
                </small>

              </div>

              <div className="avatar">
                {initials(displayName)}
              </div>

            </div>

          </div>

        </header>

        {/* ==================================================
            PAGE CONTENT
        ================================================== */}

        {isProfessional ? (

          /*
           * =================================================
           * PROFESSIONAL APPLICATION
           * =================================================
           */

          selectedPatientId ? (

            /*
             * ------------------------------------------------
             * INDIVIDUAL PATIENT CLINICAL REVIEW
             * ------------------------------------------------
             */

            <ProfessionalPatient
              patientId={selectedPatientId}
              onBack={() => {
                setSelectedPatientId(null);
                setView('professional');
              }}
            />

          ) : (

            /*
             * ------------------------------------------------
             * PROFESSIONAL MAIN PAGES
             * ------------------------------------------------
             */

            <>

              {/* =================================================
                  PROFESSIONAL DASHBOARD
              ================================================= */}

              {view === 'professional' && (
                <ProfessionalDashboard
                  onPatientOpen={
                    openPatient
                  }
                />
              )}

              {/* =================================================
                  MEDICATION MONITORING
              ================================================= */}

              {view ===
                'professional-medications' && (
                <MedicationMonitoring />
              )}

              {/* =================================================
                  SYMPTOMS & SAFETY MONITORING
              ================================================= */}

              {view ===
                'professional-safety' && (
                <SafetyMonitoring />
              )}

            </>

          )

        ) : (

          /*
           * =================================================
           * PATIENT APPLICATION
           * =================================================
           */

          <div className="font-scaled">

            {/* ----------------------------------------------
                HOME
            ---------------------------------------------- */}

            {view === 'home' && (
              <PatientHome />
            )}

            {/* ----------------------------------------------
                PROFILE
            ---------------------------------------------- */}

            {view === 'profile' && (
              <PatientProfilePage />
            )}

            {/* ----------------------------------------------
                MEDICATIONS
            ---------------------------------------------- */}

            {view === 'medications' && (
              <MedicationManagement />
            )}

            {/* ----------------------------------------------
                FOOD
            ---------------------------------------------- */}

            {view === 'food' && (
              <FoodInteractions />
            )}

            {/* ----------------------------------------------
                PRESCRIPTIONS
            ---------------------------------------------- */}

            {view === 'prescriptions' && (
              <PrescriptionHistory />
            )}

            {/* ----------------------------------------------
                SAFETY REPORTS
            ---------------------------------------------- */}

            {view === 'safety' && (
              <SafetyReports />
            )}

            {/* ----------------------------------------------
                GUIDANCE
            ---------------------------------------------- */}

            {view === 'guidance' && (
              <PersonalizedGuidance />
            )}

            {/* ----------------------------------------------
                SETTINGS
            ---------------------------------------------- */}

            {view === 'settings' && (
              <Settings
                dark={dark}
                setDark={setDark}
                fontScale={fontScale}
                setFontScale={setFontScale}
              />
            )}

          </div>

        )}

      </main>

    </div>
  );
}

// ============================================================
// NAV ITEM
// ============================================================

function NavItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${
        active ? 'active' : ''
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ============================================================
// PAGE TITLES
// ============================================================

function getTitle(
  view: View,
  patientId: string | null,
  professional: boolean
) {
  /*
   * ----------------------------------------------------------
   * PROFESSIONAL PATIENT REVIEW
   * ----------------------------------------------------------
   */

  if (
    professional &&
    patientId
  ) {
    return 'Patient Clinical Review';
  }

  /*
   * ----------------------------------------------------------
   * PAGE TITLES
   * ----------------------------------------------------------
   */

  const titles: Record<
    View,
    string
  > = {
    // Patient
    home:
      'Good day',

    profile:
      'Patient Profile',

    medications:
      'Medication Management',

    food:
      'Food & Drug Interactions',

    prescriptions:
      'Prescription History',

    safety:
      'How You Feel',

    guidance:
      'Personalized Food & Administration Guidance',

    settings:
      'Settings',

    // Professional
    professional:
      'Healthcare Professional Dashboard',

    'professional-medications':
      'Medication Monitoring',

    'professional-safety':
      'Symptoms & Safety Reports',
  };

  return titles[view];
}

// ============================================================
// INITIALS
// ============================================================

function initials(
  name?: string | null
) {
  if (!name) {
    return 'MM';
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) => part[0]
    )
    .join('')
    .toUpperCase();
}

// ============================================================
// EXPORT
// ============================================================

export default App;