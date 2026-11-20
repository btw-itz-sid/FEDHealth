import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/ui/PageHeader';

export default function AdminPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const visibleUsers = users?.items?.filter((u: any) => `${u.email} ${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())) || [];

  const loadUsers = () => {
    setLoadingUsers(true);
    return api.getUsers(1, 50).then(setUsers).catch(() => setError('Could not load accounts. Please try again.')).finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    loadUsers();
    api.getAuditLogs().then(setAuditLogs).catch(() => setError('Could not load audit events. Please reload to try again.')).finally(() => setLoadingLogs(false));
  }, []);

  const changeRole = async (id: string, role: string) => {
    setError('');
    setBusyId(id);
    try {
      await api.updateUserRole(id, role);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Could not change role');
    } finally {
      setBusyId(null);
    }
  };

  const setActive = async (id: string, active: boolean) => {
    setError('');
    setBusyId(id);
    try {
      if (active) await api.reactivateUser(id);
      else await api.deactivateUser(id);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Could not update account');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="ACCESS & ACTIVITY" title="Administration" description="Manage workspace access and review recorded account activity." />
      {error && <div role="alert" className="form-feedback">{error}</div>}

      {/* Tabs */}
      <div className="segmented mb-6" aria-label="Administration sections">
        {(['users', 'audit'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}>
            {t === 'audit' ? 'Audit Logs' : 'Users'}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div className="card">
          <label htmlFor="account-search" className="block text-sm mb-2">Find an account</label><input id="account-search" className="input mb-5 max-w-md" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email" />
          <p className="text-sm text-[var(--color-text-muted)] mb-4">Showing {visibleUsers.length} of {users?.total ?? users?.items?.length ?? 0} accounts. This view loads the first 50 accounts.</p>
          {loadingUsers ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div></div>
          ) : visibleUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Email</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Name</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Role</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Joined</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((u: any) => {
                    const isSelf = u.id === me?.id;
                    return (
                    <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-3 px-2">{u.email}</td>
                      <td className="py-3 px-2">{u.firstName} {u.lastName}</td>
                      <td className="py-3 px-2">
                        <select
                          aria-label={`Role for ${u.email}`}
                          className="input py-1.5 text-sm capitalize"
                          value={u.role}
                          disabled={isSelf || busyId === u.id}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                        >
                          <option value="patient">patient</option>
                          <option value="researcher">researcher</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-2"><span className={`badge ${u.isActive ? 'badge-success' : 'badge-error'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td className="py-3 px-2 text-[var(--color-text-muted)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-2">
                        {isSelf ? (
                          <span className="text-xs text-[var(--color-text-muted)]">You</span>
                        ) : (
                          <button
                            className="btn-secondary text-xs"
                            disabled={busyId === u.id}
                            onClick={() => setActive(u.id, !u.isActive)}
                          >
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-[var(--color-text-muted)]">No users found</p>
          )}
        </div>
      )}

      {/* Audit logs tab */}
      {tab === 'audit' && (
        <div className="card">
          {loadingLogs ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div></div>
          ) : auditLogs?.items?.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.items.map((log: any) => (
                <div key={log.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] text-sm">
                  <span className="badge badge-neutral text-xs font-mono">{log.action}</span>
                  <span className="text-[var(--color-text-secondary)]">{log.userEmail || 'System'}</span>
                  {log.resourceType && <span className="text-[var(--color-text-muted)]">→ {log.resourceType}</span>}
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-[var(--color-text-muted)]">No audit logs yet</p>
          )}
        </div>
      )}
    </div>
  );
}
