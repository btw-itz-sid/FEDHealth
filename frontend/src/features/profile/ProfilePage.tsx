import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (form.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(form.currentPassword, form.newPassword);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Password updated' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update password' });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Account</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Name</dt><dd className="font-medium">{user?.firstName} {user?.lastName}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Email</dt><dd className="font-medium">{user?.email}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Role</dt><dd><span className="badge badge-info capitalize">{user?.role}</span></dd></div>
        </dl>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Change password</h2>
        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
        <div>
          <label className="label" htmlFor="currentPassword">Current password</label>
          <input id="currentPassword" type="password" autoComplete="current-password" required className="input" value={form.currentPassword} onChange={update('currentPassword')} />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">New password</label>
          <input id="newPassword" type="password" autoComplete="new-password" required minLength={8} className="input" value={form.newPassword} onChange={update('newPassword')} />
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">Confirm new password</label>
          <input id="confirmPassword" type="password" autoComplete="new-password" required className="input" value={form.confirmPassword} onChange={update('confirmPassword')} />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  );
}
