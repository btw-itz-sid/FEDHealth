import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '@/lib/api';
import { downloadFile, methodLabel, num, pct, statusBadge, toCsv } from '@/lib/format';

function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  return (
    <table className="text-sm border border-[var(--color-border)]">
      <thead>
        <tr>
          <th className="p-2"></th>
          <th className="p-2 text-xs text-[var(--color-text-muted)]">Pred: no diabetes</th>
          <th className="p-2 text-xs text-[var(--color-text-muted)]">Pred: diabetes</th>
        </tr>
      </thead>
      <tbody>
        {matrix.map((row, i) => (
          <tr key={i}>
            <td className="p-2 text-xs text-[var(--color-text-muted)] font-medium">{i === 0 ? 'True: no diabetes' : 'True: diabetes'}</td>
            {row.map((val, j) => (
              <td key={j} className={`p-3 text-center font-mono font-medium ${i === j ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{val}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [experiment, setExperiment] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return Promise.all([
      api.getExperiment(id),
      api.getExperimentRounds(id).catch(() => ({ rounds: [] })),
    ]).then(([exp, rnd]) => {
      setExperiment(exp);
      setRounds(rnd?.rounds || []);
    }).catch(() => setExperiment(null)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const active = experiment?.status === 'queued' || experiment?.status === 'running';
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(load, 1500);
    return () => clearInterval(timer);
  }, [active, load]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div></div>;
  }
  if (!experiment) {
    return <div className="card text-center py-12"><p className="text-[var(--color-text-muted)]">Experiment not found</p></div>;
  }

  const m = experiment.finalMetrics;
  const isFederated = experiment.trainingMethod !== 'centralized';
  const isLocal = experiment.trainingMethod === 'local_only';
  const clients: any[] = m?.clients || [];
  const lastRoundClients: any[] = rounds[rounds.length - 1]?.clientMetrics || [];

  const roundSeries = rounds.map((r) => ({
    round: r.roundNumber,
    accuracy: r.evalMetrics?.accuracy,
    f1: r.evalMetrics?.f1_score,
    auc: r.evalMetrics?.roc_auc,
    loss: r.evalMetrics?.loss,
    trainLoss: r.trainMetrics?.loss,
  }));

  const clientSeries = clients.map((c) => ({
    client: `Client ${c.client_id + 1}`,
    'No diabetes': c.class_distribution?.['0'] ?? 0,
    Diabetes: c.class_distribution?.['1'] ?? 0,
  }));

  const exportJson = () => {
    downloadFile(`${experiment.name}.json`, JSON.stringify({ experiment, rounds }, null, 2), 'application/json');
  };
  const exportCsv = () => {
    downloadFile(`${experiment.name}-rounds.csv`, toCsv(rounds.map((r) => ({
      round: r.roundNumber,
      accuracy: r.evalMetrics?.accuracy,
      precision: r.evalMetrics?.precision,
      recall: r.evalMetrics?.recall,
      f1_score: r.evalMetrics?.f1_score,
      roc_auc: r.evalMetrics?.roc_auc,
      loss: r.evalMetrics?.loss,
      cumulative_epsilon: r.evalMetrics?.privacy?.cumulative_epsilon,
      communication_bytes: r.communicationBytes,
      duration_seconds: r.durationSeconds,
    }))), 'text/csv');
  };

  const cancel = async () => {
    setCancelling(true);
    try { await api.cancelExperiment(experiment.id); await load(); } finally { setCancelling(false); }
  };

  return (
    <div>
      <Link to="/experiments" className="text-sm text-[var(--color-primary-600)] hover:underline mb-4 inline-block">← Back to Experiments</Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{experiment.name}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{methodLabel(experiment)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge text-sm ${statusBadge(experiment.status)}`}>
            {experiment.status === 'running' && <span className="status-dot status-dot-running mr-1.5" />}
            {experiment.status}
          </span>
          {active && <button onClick={cancel} disabled={cancelling} className="btn-secondary text-xs">Cancel</button>}
          {experiment.status === 'completed' && (
            <>
              <button onClick={exportCsv} className="btn-secondary text-xs">Export CSV</button>
              <button onClick={exportJson} className="btn-secondary text-xs">Export JSON</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Configuration</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Method', methodLabel(experiment)],
              ...(isFederated ? [
                ['Clients', experiment.numClients],
                ['Rounds', experiment.numRounds],
                ['Local epochs', experiment.localEpochs],
                ['Learning rate', experiment.learningRate],
                ['Batch size', experiment.batchSize],
              ] : []),
              ['Random seed', experiment.randomSeed],
              ['Test size', experiment.testSize],
              ...(experiment.differentialPrivacy ? [
                ['DP ε per round', experiment.dpConfig?.epsilon],
                ['DP δ per round', experiment.dpConfig?.delta],
                ['DP clip norm', experiment.dpConfig?.clipNorm],
              ] : [['Differential privacy', 'Off']]),
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between">
                <dt className="text-[var(--color-text-secondary)]">{k}</dt>
                <dd className="font-medium">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Run</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Created</dt><dd>{new Date(experiment.createdAt).toLocaleString()}</dd></div>
            {experiment.completedAt && <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Finished</dt><dd>{new Date(experiment.completedAt).toLocaleString()}</dd></div>}
            {experiment.durationSeconds != null && <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Duration</dt><dd className="font-medium">{experiment.durationSeconds.toFixed(2)}s</dd></div>}
            {m?.num_train_samples != null && <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Train / test samples</dt><dd className="font-medium">{m.num_train_samples} / {m.num_test_samples}</dd></div>}
            {m?.total_communication_bytes != null && isFederated && !isLocal && (
              <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Communication</dt><dd className="font-medium">{(m.total_communication_bytes / 1024).toFixed(1)} KB</dd></div>
            )}
            {experiment.modelId ? (
              <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Model</dt><dd><Link to="/models" className="font-mono text-xs text-[var(--color-primary-600)] hover:underline">{experiment.modelId}</Link></dd></div>
            ) : isLocal && experiment.status === 'completed' ? (
              <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Model</dt><dd className="text-xs text-[var(--color-text-muted)]">None (no shared model in local-only)</dd></div>
            ) : null}
          </dl>
        </div>
      </div>

      {experiment.errorMessage && (
        <div className="card mb-6 border-[var(--color-error)]/30 bg-red-50">
          <h2 className="text-sm font-semibold text-[var(--color-error)] mb-2">Error</h2>
          <p className="text-sm text-red-700">{experiment.errorMessage}</p>
        </div>
      )}

      {active && (
        <div className="card mb-6 text-center py-8 text-[var(--color-text-secondary)]">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)] mx-auto mb-3"></div>
          Training in progress…
        </div>
      )}

      {m && (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Test-set metrics</h2>
          {isLocal && <p className="text-xs text-[var(--color-text-muted)] mb-3">Mean ± std across clients, each evaluated on the shared test set.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 my-4">
            {[
              ['Accuracy', pct(m.accuracy, 2), m.accuracy_std],
              ['Precision', num(m.precision), m.precision_std],
              ['Recall', num(m.recall), m.recall_std],
              ['F1-score', num(m.f1_score), m.f1_score_std],
              ['ROC-AUC', num(m.roc_auc), m.roc_auc_std],
            ].map(([label, value, std]) => (
              <div key={String(label)} className="text-center p-3 rounded-lg bg-[var(--color-surface-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
                <p className="text-lg font-bold">{value}</p>
                {std != null && <p className="text-[10px] text-[var(--color-text-muted)]">± {(Number(std) * (label === 'Accuracy' ? 100 : 1)).toFixed(label === 'Accuracy' ? 2 : 4)}</p>}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-8">
            {m.confusion_matrix && (
              <div>
                <h3 className="text-sm font-medium mb-2">Confusion matrix{isLocal && ' (summed over clients)'}</h3>
                <ConfusionMatrix matrix={m.confusion_matrix} />
              </div>
            )}
            {m.privacy && (
              <div className="min-w-64">
                <h3 className="text-sm font-medium mb-2">Privacy budget</h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-6"><dt className="text-[var(--color-text-secondary)]">Total ε spent</dt><dd className="font-bold">{m.privacy.cumulative_epsilon}</dd></div>
                  <div className="flex justify-between gap-6"><dt className="text-[var(--color-text-secondary)]">Total δ</dt><dd className="font-medium">{Number(m.privacy.cumulative_delta).toExponential(1)}</dd></div>
                  <div className="flex justify-between gap-6"><dt className="text-[var(--color-text-secondary)]">Noise σ per update</dt><dd className="font-medium">{num(m.privacy.noise_sigma, 3)}</dd></div>
                  <p className="text-xs text-[var(--color-text-muted)] pt-1">{m.privacy.accounting}</p>
                </dl>
              </div>
            )}
          </div>
        </div>
      )}

      {roundSeries.length > 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
          <div className="card">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Test metrics per round</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={roundSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="round" fontSize={12} label={{ value: 'Round', position: 'insideBottom', offset: -2, fontSize: 12 }} />
                  <YAxis domain={[0, 1]} fontSize={12} />
                  <Tooltip formatter={(v: number) => v?.toFixed(4)} />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="f1" name="F1" stroke="#14b8a6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="auc" name="ROC-AUC" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Log loss per round</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={roundSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="round" fontSize={12} />
                  <YAxis fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v: number) => v?.toFixed(4)} />
                  <Legend />
                  <Line type="monotone" dataKey="loss" name="Test loss" stroke="#ef4444" strokeWidth={2} dot={false} />
                  {!isLocal && <Line type="monotone" dataKey="trainLoss" name="Train loss" stroke="#8b5cf6" strokeWidth={2} dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {clients.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
          <div className="card">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Client data distribution</h2>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">How the training data was split across simulated hospitals.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="client" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="No diabetes" stackId="a" fill="#14b8a6" />
                  <Bar dataKey="Diabetes" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Clients in final round</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                    <th className="py-2 px-2 font-medium">Client</th>
                    <th className="py-2 px-2 font-medium">Samples</th>
                    <th className="py-2 px-2 font-medium">% diabetic</th>
                    {isLocal ? (
                      <>
                        <th className="py-2 px-2 font-medium">Test acc.</th>
                        <th className="py-2 px-2 font-medium">Test F1</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2 px-2 font-medium">Local train acc.</th>
                        <th className="py-2 px-2 font-medium">Update norm</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lastRoundClients.map((c) => (
                    <tr key={c.client_id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2 px-2">Client {c.client_id + 1}</td>
                      <td className="py-2 px-2">{c.num_samples}</td>
                      <td className="py-2 px-2">{pct((c.class_distribution?.['1'] ?? 0) / Math.max(c.num_samples, 1))}</td>
                      {isLocal ? (
                        <>
                          <td className="py-2 px-2">{pct(c.test_accuracy)}</td>
                          <td className="py-2 px-2">{num(c.test_f1_score, 3)}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-2">{pct(c.train_accuracy)}</td>
                          <td className="py-2 px-2">{num(c.update_norm, 3)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
