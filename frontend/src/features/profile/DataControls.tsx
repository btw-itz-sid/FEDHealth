import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RecoveryKeyCard from '@/components/RecoveryKeyCard';
import api from '@/lib/api';

type Action = 'recovery' | 'history' | 'account';
export default function DataControls() {
  const { user } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const choose = (next: Action) => { setAction(next); setPassword(''); setConfirmed(false); setMessage(''); setError(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (action === 'recovery') setKey((await api.rotateRecoveryKey(password)).recoveryCode);
      else if (action === 'history') { await api.clearAssessmentHistory(password); setMessage('Your saved assessments have been deleted.'); }
      else if (action === 'account') { await api.deletePersonalAccount(password); window.location.replace('/login'); }
      setPassword(''); setAction(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'This action could not be completed.'); }
    finally { setBusy(false); }
  };
  return <section className="card mt-6 max-w-4xl"><h2 className="text-lg font-medium">Recovery & your data</h2><p className="text-sm text-[var(--color-text-secondary)] mt-2 mb-5">Manage your recovery key and the assessments saved to your account.</p>
    {key ? <RecoveryKeyCard code={key} onContinue={() => setKey('')} /> : <>
      <div className="flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => choose('recovery')} disabled={busy}>Create or replace recovery key</button><button className="btn-secondary" onClick={() => choose('history')} disabled={busy}>Delete assessment history</button>{user?.role === 'patient' && <button className="btn-secondary" onClick={() => choose('account')} disabled={busy}>Delete my account</button>}</div>
      {user?.role !== 'patient' && <p className="text-xs text-[var(--color-text-muted)] mt-4">Research and administrator account deletion needs operator review because shared research records must be preserved. You can delete your own assessment history here.</p>}
      {message && <p className="mt-5 text-sm" role="status">{message}</p>}
      {action && <form onSubmit={submit} className="mt-6 pt-5 border-t border-[var(--color-border)] space-y-4">
        <h3 className="font-medium">{action === 'recovery' ? 'Replace your recovery key' : action === 'history' ? 'Delete all your saved assessments' : 'Permanently delete your personal account'}</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{action === 'recovery' ? 'Any previous recovery key will stop working. You will see the new key only once.' : action === 'history' ? 'This deletes your input measurements and results from the live application. It cannot be undone here.' : 'This deletes your personal account and all its saved assessments from the live application. It cannot be undone here.'}</p>
        <div><label className="label" htmlFor="data-password">Current password</label><input id="data-password" className="input max-w-md" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></div>
        {action !== 'recovery' && <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required/>I understand this permanently deletes {action === 'history' ? 'my assessment history' : 'my account and assessments'} from the live app.</label>}
        <div className="flex gap-3"><button className="btn-primary" disabled={busy || (action !== 'recovery' && !confirmed)}>{busy ? 'Working…' : action === 'recovery' ? 'Create replacement key' : 'Confirm deletion'}</button><button className="btn-secondary" type="button" onClick={() => setAction(null)} disabled={busy}>Cancel</button></div>
      </form>}{error && <p role="alert" className="form-feedback mt-4">{error}</p>}
    </>}
  </section>;
}
