import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

/** Registration form; on success stores the session and navigates to the dashboard. */
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-center">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1 className="brand">
          <span className="brand-mark">⬡</span> FlowBoard
        </h1>
        <p className="subtitle">Create your account</p>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <label className="field">
          <span>Name</span>
          <input type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>

        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <small className="field-hint">At least 8 characters, with letters and numbers</small>
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="hint">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}