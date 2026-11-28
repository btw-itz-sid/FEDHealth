import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthLayout from '@/components/layout/AuthLayout';
import Icon from '@/components/ui/Icon';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (isAuthenticated) return <Navigate to="/" replace />;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await login(email.trim(), password); navigate('/', { replace: true }); }
    catch (error) { setError(error instanceof Error ? error.message : 'We could not sign you in. Please try again.'); }
    finally { setLoading(false); }
  };
  return <AuthLayout>
    <p className="eyebrow">Your research workspace</p>
    <h1>Welcome back.</h1>
    <p className="auth-intro">Sign in to continue your research, explore a training run, or review an assessment.</p>
    <p className="mb-5 text-sm"><Link to="/recover" className="section-link">Forgot your password?</Link></p>
    {error && <div className="form-feedback" role="alert">{error}</div>}
    <form onSubmit={submit} className="space-y-5">
      <div><label className="label" htmlFor="login-email">Email address</label><input id="login-email" className="input" type="email" autoComplete="email" placeholder="you@institution.edu" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} /></div>
      <div><label className="label" htmlFor="login-password">Password</label><div className="password-field"><input id="login-password" className="input" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} /><button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}><Icon name={visible ? 'eyeOff' : 'eye'} size={18} /></button></div></div>
      <button type="submit" disabled={loading} className="btn-primary" aria-busy={loading}>{loading ? 'Signing you in…' : 'Sign in to workspace'}</button>
    </form>
    <p className="auth-form-footer">New to FedHealth? <Link to="/register">Create an account</Link></p>
    <div className="auth-trust"><Icon name="lock" size={15} /><p>One secure sign-in for patients, researchers and administrators. Your account determines the tools you can access.</p></div>
    <p className="text-xs text-[var(--color-text-muted)] mt-6">For education and research. Predictions are estimates and are not intended for clinical decisions.</p>
  </AuthLayout>;
}
