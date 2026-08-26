import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export default function Login() {
  const { signIn } = useAuth();
  const { show } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) {
      setError(signInError);
      setLoading(false);
    } else {
      show('Welcome to MediMind');
    }
  };

  const fillDemo = (type: 'patient' | 'professional') => {
    setEmail(`${type}@medimind.com`);
    setPassword('MediMind123!');
    setError(null);
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="logo">Medi<span>Mind</span></div>
        <div className="tagline">AI-Assisted Personalized Medication & Healthcare Companion</div>
        <div className="hero">
          <h1>Smarter medication.<br />Safer decisions.</h1>
          <p>A personalized healthcare companion that connects prescriptions, medication schedules, food intake, drug-food interactions, adherence and professional monitoring.</p>
          <div className="ai-badge">AI-Assisted Medication Intelligence</div>
        </div>
      </div>

      <div className="login-right">
        <h2>Welcome to MediMind</h2>
        <p className="login-subtitle">Sign in to your account to continue</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Continue to MediMind'}
          </button>
        </form>

        <div className="login-creds">
          <b>Demo accounts:</b><br />
          Patient: patient@medimind.com / MediMind123!<br />
          Professional: professional@medimind.com / MediMind123!
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="secondary-btn" style={{ flex: 1, fontSize: 11, padding: '7px 10px' }} onClick={() => fillDemo('patient')}>Fill patient</button>
            <button className="secondary-btn" style={{ flex: 1, fontSize: 11, padding: '7px 10px' }} onClick={() => fillDemo('professional')}>Fill professional</button>
          </div>
        </div>

        <p className="demo-note">Prototype demonstration - No real patient data required</p>
      </div>
    </div>
  );
}
