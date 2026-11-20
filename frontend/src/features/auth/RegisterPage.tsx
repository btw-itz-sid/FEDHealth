import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthLayout from '@/components/layout/AuthLayout';
import Icon from '@/components/ui/Icon';

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (isAuthenticated) return <Navigate to="/" replace />;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await register({ ...form, email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim() }); navigate('/', { replace: true }); }
    catch (error) { setError(error instanceof Error ? error.message : 'We could not create your account.'); }
    finally { setLoading(false); }
  };
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <AuthLayout>
    <p className="eyebrow">Start with a workspace</p><h1>Create your account.</h1><p className="auth-intro">Save your assessments and keep track of your results in one place.</p>
    <p className="text-sm text-[var(--color-text-muted)] mb-5">Research workspace access is granted by an administrator.</p>
    {error && <div className="form-feedback" role="alert">{error}</div>}
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">{(['firstName', 'lastName'] as const).map((key) => <div key={key}><label htmlFor={key} className="label">{key === 'firstName' ? 'First name' : 'Last name'}</label><input id={key} className="input" autoComplete={key === 'firstName' ? 'given-name' : 'family-name'} required maxLength={100} value={form[key]} onChange={(e) => update(key, e.target.value)} disabled={loading} /></div>)}</div>
      <div><label className="label" htmlFor="register-email">Email address</label><input id="register-email" className="input" type="email" autoComplete="email" placeholder="you@institution.edu" required value={form.email} onChange={(e) => update('email', e.target.value)} disabled={loading} /></div>
      <div><label className="label" htmlFor="register-password">Create a password</label><div className="password-field"><input id="register-password" className="input" type={visible ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} maxLength={128} required value={form.password} onChange={(e) => update('password', e.target.value)} disabled={loading} /><button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}><Icon name={visible ? 'eyeOff' : 'eye'} size={18} /></button></div><p className="text-xs text-[var(--color-text-muted)] mt-2">Use a unique password with at least 8 characters.</p></div>
      <button type="submit" disabled={loading} className="btn-primary" aria-busy={loading}>{loading ? 'Creating your workspace…' : 'Create account'}</button>
    </form>
    <p className="auth-form-footer">Already have an account? <Link to="/login">Sign in</Link></p>
    <div className="auth-trust"><Icon name="info" size={15} /><p>This is an educational research platform. Its estimates do not replace professional medical advice.</p></div>
  </AuthLayout>;
}
