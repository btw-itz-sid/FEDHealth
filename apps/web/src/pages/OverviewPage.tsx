import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export default function OverviewPage() {
  const { user } = useAuth();
  const [experiments, setExperiments] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'researcher' || user?.role === 'admin') {
      api.getExperiments(1, 5)
        .then(setExperiments)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const statusCounts = experiments?.items?.reduce(
    (acc: any, exp: any) => {
      acc[exp.status] = (acc[exp.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  ) || {};

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Welcome, {user?.firstName}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          FedHealth — Privacy-Preserving Diabetes Research Platform
        </p>
      </div>

      {/* Stat cards */}
      {(user?.role === 'researcher' || user?.role === 'admin') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="stat-card card">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Total Experiments</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {loading ? '—' : experiments?.total || 0}
            </p>
          </div>
          <div className="stat-card card">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Completed</p>
            <p className="text-2xl font-bold text-[var(--color-success)]">
              {loading ? '—' : statusCounts.completed || 0}
            </p>
          </div>
          <div className="stat-card card">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Running</p>
            <p className="text-2xl font-bold text-[var(--color-warning)]">
              {loading ? '—' : statusCounts.running || 0}
            </p>
          </div>
          <div className="stat-card card">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Failed</p>
            <p className="text-2xl font-bold text-[var(--color-error)]">
              {loading ? '—' : statusCounts.failed || 0}
            </p>
          </div>
        </div>
      )}

      {/* Recent experiments */}
      {(user?.role === 'researcher' || user?.role === 'admin') && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Experiments</h2>
            <Link to="/experiments" className="text-sm text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] font-medium">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div>
            </div>
          ) : experiments?.items?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Name</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Method</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Accuracy</th>
                    <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {experiments.items.map((exp: any) => (
                    <tr key={exp.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-secondary)] transition-colors">
                      <td className="py-3 px-2">
                        <Link to={`/experiments/${exp.id}`} className="font-medium text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)]">
                          {exp.name}
                        </Link>
                      </td>
                      <td className="py-3 px-2 capitalize">{exp.trainingMethod?.replace('_', ' ')}</td>
                      <td className="py-3 px-2">
                        <span className={`badge ${
                          exp.status === 'completed' ? 'badge-success' :
                          exp.status === 'running' ? 'badge-warning' :
                          exp.status === 'failed' ? 'badge-error' :
                          exp.status === 'queued' ? 'badge-info' : 'badge-neutral'
                        }`}>
                          {exp.status === 'running' && <span className="status-dot status-dot-running mr-1.5" />}
                          {exp.status}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {exp.finalMetrics?.accuracy != null
                          ? `${(exp.finalMetrics.accuracy * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="py-3 px-2 text-[var(--color-text-muted)]">
                        {new Date(exp.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[var(--color-text-muted)] mb-3">No experiments yet</p>
              <Link to="/experiments" className="inline-flex px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] transition-colors">
                Create First Experiment
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Patient view */}
      {user?.role === 'patient' && (
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">🏥</p>
          <h2 className="text-xl font-semibold mb-2">Patient Dashboard</h2>
          <p className="text-[var(--color-text-secondary)] mb-4 max-w-md mx-auto">
            Use the mobile app to submit diabetes risk assessments and view your prediction history.
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            This web dashboard is designed for researchers and administrators.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <strong>Research Platform Disclaimer:</strong> FedHealth is an educational and research platform.
        All predictions are research estimates and must not be used for clinical diagnosis.
        Consult a qualified healthcare professional for medical advice.
      </div>
    </div>
  );
}
