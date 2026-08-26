import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import Login from '@/pages/Login';

import PatientHome from '@/pages/patient/Home';
import PatientProfilePage from '@/pages/patient/Profile';
import MedicationManagement from '@/pages/patient/Medications';
import FoodInteractions from '@/pages/patient/FoodInteractions';
import PrescriptionHistory from '@/pages/patient/PrescriptionHistory';
import SafetyReports from '@/pages/patient/SafetyReports';
import PersonalizedGuidance from '@/pages/patient/Guidance';
import Settings from '@/pages/patient/Settings';

import ProfessionalDashboard from '@/pages/professional/Dashboard';
import MedicationMonitoring from '@/pages/professional/MedicationMonitoring';
import ProfessionalPatient from '@/pages/professional/Patient';

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
  | 'professional-medications';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ToastProvider>
  );
}

function AuthenticatedApp() {
  const {
    session,
    loading,
    profile,
    patientProfile,
    professionalProfile,
    signOut,
  } = useAuth();

  const [view, setView] = useState<View>('home');
  const [selectedPatientId, setSelectedPatientId] =
    useState<string | null>(null);

  const [dark, setDark] = useState(
    () => localStorage.getItem('medimind-theme') === 'dark'
  );

  const [fontScale, setFontScale] = useState(
    () =>
      Number(
        localStorage.getItem('medimind-font-scale') || 100
      )
  );

  useEffect(() => {
    document.body.classList.toggle('dark-theme', dark);

    localStorage.setItem(
      'medimind-theme',
      dark ? 'dark' : 'light'
    );
  }, [dark]);

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

  if (loading) {
    return (
      <div className="loading-screen">
        Loading MediMind...
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const role =
    profile?.role ||
    (professionalProfile ? 'professional' : 'patient');

  const isProfessional =
    role === 'professional' || role === 'admin';

  const go = (next: View) => {
    setSelectedPatientId(null);
    setView(next);
  };

  const openPatient = (id: string) => {
    setSelectedPatientId(id);
    setView('professional');
  };

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="sidebar-logo">
          <div className="logo">
            Medi<span>Mind</span>
          </div>

          <div className="tagline">
            Medication & Food Intelligence
          </div>
        </div>

        <div className="sidebar-role">
          <b>
            {isProfessional
              ? professionalProfile?.full_name ||
                'Healthcare Professional'
              : patientProfile?.full_name || 'Patient'}
          </b>

          <span>
            {isProfessional
              ? 'Healthcare Professional'
              : 'Patient account'}
          </span>
        </div>

        <nav>

          {isProfessional ? (
            <>
              <NavItem
                label="Professional Dashboard"
                active={
                  view === 'professional' &&
                  !selectedPatientId
                }
                onClick={() => go('professional')}
              />

              <NavItem
                label="Medication Monitoring"
                active={
                  view === 'professional-medications'
                }
                onClick={() =>
                  go('professional-medications')
                }
              />
            </>
          ) : (
            <>
              <NavItem
                label="Home"
                active={view === 'home'}
                onClick={() => go('home')}
              />

              <NavItem
                label="Patient Profile"
                active={view === 'profile'}
                onClick={() => go('profile')}
              />

              <NavItem
                label="Medication Management"
                active={view === 'medications'}
                onClick={() => go('medications')}
              />

              <NavItem
                label="Food & Interactions"
                active={view === 'food'}
                onClick={() => go('food')}
              />

              <NavItem
                label="Prescription History"
                active={view === 'prescriptions'}
                onClick={() => go('prescriptions')}
              />

              <NavItem
                label="How You Feel"
                active={view === 'safety'}
                onClick={() => go('safety')}
              />

              <NavItem
                label="Personalized Guidance"
                active={view === 'guidance'}
                onClick={() => go('guidance')}
              />

              <NavItem
                label="Settings"
                active={view === 'settings'}
                onClick={() => go('settings')}
              />
            </>
          )}

        </nav>

        <button
          className="logout"
          onClick={() => signOut()}
        >
          Sign out
        </button>

      </aside>

      {/* MAIN */}
      <main className="main">

        <header className="topbar">

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

          <div className="top-actions">

            <button
              className="secondary-btn"
              onClick={() => setDark(v => !v)}
            >
              {dark ? 'Light theme' : 'Dark theme'}
            </button>

            <div className="profile">

              <div>
                <strong>
                  {isProfessional
                    ? professionalProfile?.full_name
                    : patientProfile?.full_name}
                </strong>

                <small>
                  {isProfessional
                    ? 'Professional'
                    : 'Patient'}
                </small>
              </div>

              <div className="avatar">
                {initials(
                  isProfessional
                    ? professionalProfile?.full_name
                    : patientProfile?.full_name
                )}
              </div>

            </div>

          </div>

        </header>

        {/* PROFESSIONAL ROUTING */}
        {isProfessional ? (

          selectedPatientId ? (

            <ProfessionalPatient
              patientId={selectedPatientId}
              onBack={() => {
                setSelectedPatientId(null);
                setView('professional');
              }}
            />

          ) : view === 'professional-medications' ? (

            <MedicationMonitoring />

          ) : (

            <ProfessionalDashboard
              onPatientOpen={openPatient}
            />

          )

        ) : (

          <div className="font-scaled">

            {view === 'home' && <PatientHome />}

            {view === 'profile' && (
              <PatientProfilePage />
            )}

            {view === 'medications' && (
              <MedicationManagement />
            )}

            {view === 'food' && (
              <FoodInteractions />
            )}

            {view === 'prescriptions' && (
              <PrescriptionHistory />
            )}

            {view === 'safety' && (
              <SafetyReports />
            )}

            {view === 'guidance' && (
              <PersonalizedGuidance />
            )}

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
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function getTitle(
  view: View,
  patientId: string | null,
  professional: boolean
) {
  if (professional && patientId) {
    return 'Patient Clinical Review';
  }

  const titles: Record<View, string> = {
    home: 'Good day',
    profile: 'Patient Profile',
    medications: 'Medication Management',
    food: 'Food & Drug Interactions',
    prescriptions: 'Prescription History',
    safety: 'How You Feel',
    guidance:
      'Personalized Food & Administration Guidance',
    settings: 'Settings',
    professional:
      'Healthcare Professional Dashboard',
    'professional-medications':
      'Medication Monitoring',
  };

  return titles[view];
}

function initials(name?: string | null) {
  if (!name) return 'MM';

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x[0])
    .join('')
    .toUpperCase();
}

export default App;