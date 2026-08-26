import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

type Role = 'patient' | 'professional';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const { show } = useToast();

  const [isSignUp, setIsSignUp] = useState(false);

  const [role, setRole] = useState<Role>('patient');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
  };

  const switchMode = () => {
    resetForm();
    setIsSignUp((value) => !value);
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError(null);

    if (isSignUp) {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }

      if (!email.trim()) {
        setError('Please enter your email.');
        return;
      }

      if (!password.trim()) {
        setError('Please enter a password.');
        return;
      }

      if (password.length < 6) {
        setError(
          'Password must be at least 6 characters.'
        );
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError(
          'Please enter your email and password.'
        );
        return;
      }
    }

    setLoading(true);

    if (isSignUp) {
      const { error: signUpError } = await signUp(
        email.trim(),
        password,
        fullName.trim(),
        role
      );

      if (signUpError) {
        setError(signUpError);
        setLoading(false);
        return;
      }

      show('Account created successfully');

      setIsSignUp(false);
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setLoading(false);

      return;
    }

    const { error: signInError } = await signIn(
      email.trim(),
      password
    );

    if (signInError) {
      setError(signInError);
      setLoading(false);
    } else {
      show('Welcome to MediMind');
    }
  };

  const fillDemo = (demoRole: Role) => {
    setRole(demoRole);
    setEmail(`${demoRole}@medimind.com`);
    setPassword('MediMind123!');
    setError(null);
  };

  return (
    <div className="login-page">
      {/* LEFT SIDE */}
      <div className="login-left">
        <div className="logo">
          Medi<span>Mind</span>
        </div>

        <div className="tagline">
          AI-Assisted Personalized Medication &
          Healthcare Companion
        </div>

        <div className="hero">
          <h1>
            Smarter medication.
            <br />
            Safer decisions.
          </h1>

          <p>
            A personalized healthcare companion that
            connects prescriptions, medication schedules,
            food intake, drug-food interactions, adherence
            and professional monitoring.
          </p>

          <div className="ai-badge">
            ✦ AI-Assisted Medication Intelligence
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-right">
        <h2>
          {isSignUp
            ? 'Create your MediMind account'
            : 'Welcome to MediMind'}
        </h2>

        <p className="login-subtitle">
          {isSignUp
            ? 'Create your account to get started'
            : 'Select your account type to continue'}
        </p>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        {/* ROLE SELECTOR */}
        <div className="role-selector">
          <button
            type="button"
            className={`role ${
              role === 'patient' ? 'active' : ''
            }`}
            onClick={() => setRole('patient')}
            disabled={loading}
          >
            <div className="role-icon">👤</div>

            <strong>Patient</strong>

            <small>
              Personal medication companion
            </small>
          </button>

          <button
            type="button"
            className={`role ${
              role === 'professional'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setRole('professional')
            }
            disabled={loading}
          >
            <div className="role-icon">🩺</div>

            <strong>
              Healthcare Professional
            </strong>

            <small>
              Medication monitoring dashboard
            </small>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="field">
              <label>Full Name</label>

              <input
                type="text"
                value={fullName}
                onChange={(e) =>
                  setFullName(e.target.value)
                }
                placeholder="Enter your full name"
                disabled={loading}
              />
            </div>
          )}

          <div className="field">
            <label>
              {isSignUp
                ? 'Email'
                : 'Email / Mobile Number'}
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder={
                isSignUp
                  ? 'Enter your email'
                  : 'Enter email or mobile'
              }
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder={
                isSignUp
                  ? 'Create a password'
                  : 'Enter your password'
              }
              disabled={loading}
            />
          </div>

          {isSignUp && (
            <div className="field">
              <label>Confirm Password</label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
                placeholder="Confirm your password"
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
          >
            {loading
              ? isSignUp
                ? 'Creating account...'
                : 'Signing in...'
              : isSignUp
              ? 'Create Account'
              : 'Continue to MediMind'}
          </button>
        </form>

        {/* SWITCH LOGIN / SIGNUP */}
        <div className="auth-switch">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={switchMode}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={switchMode}
              >
                Create account
              </button>
            </>
          )}
        </div>

        {/* DEMO ACCOUNTS */}
        {!isSignUp && (
          <div className="login-creds">
            <b>Demo accounts</b>

            <div className="demo-account">
              <div>
                <strong>Patient</strong>
                <span>
                  patient@medimind.com
                </span>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  fillDemo('patient')
                }
              >
                Use Demo
              </button>
            </div>

            <div className="demo-account">
              <div>
                <strong>
                  Healthcare Professional
                </strong>
                <span>
                  professional@medimind.com
                </span>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  fillDemo('professional')
                }
              >
                Use Demo
              </button>
            </div>
          </div>
        )}

        <p className="demo-note">
          Prototype demonstration • No real patient
          data required
        </p>
      </div>
    </div>
  );
}