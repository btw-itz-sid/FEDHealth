import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '@/components/layout/AuthLayout';
import RecoveryKeyCard from '@/components/RecoveryKeyCard';
import api from '@/lib/api';

export default function RecoverPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', recoveryCode: '', newPassword: '', confirmation: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (form.newPassword !== form.confirmation) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await api.recoverAccount({ email: form.email.trim(), recoveryCode: form.recoveryCode.replace(/[\s-]/g, '').toLowerCase(), newPassword: form.newPassword });
      setForm({ email: '', recoveryCode: '', newPassword: '', confirmation: '' }); setReplacement(result.recoveryCode);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Account recovery failed.'); }
    finally { setBusy(false); }
  };
  return <AuthLayout>{replacement ? <><p className="mb-5 text-sm" role="status">Your password has been reset. Save your new recovery key, then sign in.</p><RecoveryKeyCard code={replacement} onContinue={() => navigate('/login', { replace: true })} /></> : <>
    <p className="eyebrow">Account recovery</p><h1>Get back into your account.</h1>
    <p className="auth-intro">Use the private recovery key you saved when creating your account or from Account settings.</p>
    {error && <p className="form-feedback" role="alert">{error}</p>}
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label" htmlFor="recovery-email">Email address</label><input className="input" id="recovery-email" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={event => update('email', event.target.value)} disabled={busy}/></div>
      <div><label className="label" htmlFor="saved-key">Saved recovery key</label><input className="input font-mono" id="saved-key" type="password" autoComplete="off" required maxLength={96} value={form.recoveryCode} onChange={event => update('recoveryCode', event.target.value)} disabled={busy}/></div>
      <div><label className="label" htmlFor="recovered-password">New password</label><input className="input" id="recovered-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.newPassword} onChange={event => update('newPassword', event.target.value)} disabled={busy}/></div>
      <div><label className="label" htmlFor="confirmed-password">Confirm new password</label><input className="input" id="confirmed-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.confirmation} onChange={event => update('confirmation', event.target.value)} disabled={busy}/></div>
      <button className="btn-primary" disabled={busy}>{busy ? 'Resetting password…' : 'Reset password'}</button>
    </form><p className="auth-form-footer"><Link to="/login">Back to sign in</Link></p>
    <p className="text-xs text-[var(--color-text-muted)] mt-5">No recovery key? If you still know your password, create one in Account settings. If both are lost, self-service recovery is unavailable. Email recovery is not configured for this demo.</p>
  </>}</AuthLayout>;
}
