import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [experiment, setExperiment] = useState<any>(null);
  const [_rounds, setRounds] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getExperiment(id),
      api.getExperimentRounds(id).catch(() => null),
    ]).then(([exp, rnd]) => {
      setExperiment(exp);
      setRounds(rnd);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div></div>;
  }

  if (!experiment) {
    return <div className="card text-center py-12"><p className="text-[var(--color-text-muted)]">Experiment not found</p></div>;
  }

  const m = experiment.finalMetrics;

  return (
    <div>
      <Link to="/experiments" className="text-sm text-[var(--color-primary-600)] hover:underline mb-4 inline-block">← Back to Experiments</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{experiment.name}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">ID: {experiment.id}</p>
        </div>
        <span className={`badge text-sm ${experiment.status === 'completed' ? 'badge-success' : experiment.status === 'failed' ? 'badge-error' : experiment.status === 'running' ? 'badge-warning' : 'badge-info'}`}>
          {experiment.status}
        </span>
      </div>

      {/* Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Configuration</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Method</dt><dd className="font-medium capitalize">{experiment.trainingMethod?.replace('_', ' ')}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Partition</dt><dd className="font-medium">{experiment.partitionType}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Clients</dt><dd className="font-medium">{experiment.numClients}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Rounds</dt><dd className="font-medium">{experiment.numRounds}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Random Seed</dt><dd className="font-medium">{experiment.randomSeed}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Test Size</dt><dd className="font-medium">{experiment.testSize}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">DP</dt><dd className="font-medium">{experiment.differentialPrivacy ? 'Enabled' : 'Disabled'}</dd></div>
          </dl>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Timing</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Created</dt><dd>{new Date(experiment.createdAt).toLocaleString()}</dd></div>
            {experiment.startedAt && <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Started</dt><dd>{new Date(experiment.startedAt).toLocaleString()}</dd></div>}
            {experiment.completedAt && <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Completed</dt><dd>{new Date(experiment.completedAt).toLocaleString()}</dd></div>}
            {experiment.durationSeconds != null && <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Duration</dt><dd className="font-medium">{experiment.durationSeconds.toFixed(2)}s</dd></div>}
            {experiment.modelId && <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Model</dt><dd className="font-mono text-xs">{experiment.modelId}</dd></div>}
          </dl>
        </div>
      </div>

      {/* Error */}
      {experiment.errorMessage && (
        <div className="card mb-6 border-[var(--color-error)]/30 bg-red-50">
          <h2 className="text-sm font-semibold text-[var(--color-error)] mb-2">Error</h2>
          <p className="text-sm text-red-700">{experiment.errorMessage}</p>
        </div>
      )}

      {/* Metrics */}
      {m && (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Evaluation Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Accuracy', value: m.accuracy, fmt: (v: number) => `${(v * 100).toFixed(2)}%` },
              { label: 'Precision', value: m.precision, fmt: (v: number) => v.toFixed(4) },
              { label: 'Recall', value: m.recall, fmt: (v: number) => v.toFixed(4) },
              { label: 'F1-Score', value: m.f1_score, fmt: (v: number) => v.toFixed(4) },
              { label: 'ROC-AUC', value: m.roc_auc, fmt: (v: number) => v?.toFixed(4) ?? 'N/A' },
              { label: 'Train Samples', value: m.num_train_samples, fmt: (v: number) => String(v) },
            ].map(({ label, value, fmt }) => (
              <div key={label} className="text-center p-3 rounded-lg bg-[var(--color-surface-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{value != null ? fmt(value) : '—'}</p>
              </div>
            ))}
          </div>

          {/* Confusion Matrix */}
          {m.confusion_matrix && (
            <div>
              <h3 className="text-sm font-medium mb-2">Confusion Matrix</h3>
              <div className="inline-block">
                <table className="text-sm border border-[var(--color-border)]">
                  <thead>
                    <tr>
                      <th className="p-2 text-xs text-[var(--color-text-muted)]"></th>
                      <th className="p-2 text-xs text-[var(--color-text-muted)]">Pred: 0</th>
                      <th className="p-2 text-xs text-[var(--color-text-muted)]">Pred: 1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.confusion_matrix.map((row: number[], i: number) => (
                      <tr key={i}>
                        <td className="p-2 text-xs text-[var(--color-text-muted)] font-medium">True: {i}</td>
                        {row.map((val: number, j: number) => (
                          <td key={j} className={`p-2 text-center font-mono font-medium ${i === j ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
