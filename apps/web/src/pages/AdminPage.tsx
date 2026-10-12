import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function AdminPage() {
  const [users, setUsers] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [tab, setTab] = useState<'users' | 'audit'>('users');

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {}).finally(() => setLoadingUsers(false));
    api.getAuditLogs().then(setAuditLogs).catch(() => {}).finally(() => setLoadingLogs(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Manage users and review audit events</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[var(--color-surface-tertiary)] rounded-lg w-fit">
        {(['users', 'audit'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}>
            {t === 'audit' ? 'Audit Logs' : 'Users'}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div className="card">
          {loadingUsers ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div></div>
          ) : users?.items?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Email</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Name</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Role</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((u: any) => (
                    <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-3 px-2">{u.email}</td>
                      <td className="py-3 px-2">{u.firstName} {u.lastName}</td>
                      <td className="py-3 px-2"><span className="badge badge-info capitalize">{u.role}</span></td>
                      <td className="py-3 px-2"><span className={`badge ${u.isActive ? 'badge-success' : 'badge-error'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td className="py-3 px-2 text-[var(--color-text-muted)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
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
                <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] text-sm">
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
