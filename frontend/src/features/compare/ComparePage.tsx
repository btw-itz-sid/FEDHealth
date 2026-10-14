import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '@/lib/api';
import { CHART_COLORS, downloadFile, methodLabel, num, pct, toCsv } from '@/lib/format';

const METRICS = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'f1_score', label: 'F1' },
  { key: 'roc_auc', label: 'ROC-AUC' },
] as const;

interface Loaded {
  experiment: any;
  rounds: any[];
}

function findings(all: any[]): string[] {
  const done = all.filter((e) => e.status === 'completed' && e.finalMetrics);
  const pick = (method: string, partition: string, dp = false) =>
    done.find((e) => e.trainingMethod === method && e.partitionType === partition && !!e.differentialPrivacy === dp);
  const acc = (e: any) => e.finalMetrics.accuracy as number;
  const out: string[] = [];

  const central = pick('centralized', 'none');
  const fedIid = pick('fedavg', 'iid');
  const fedNon = pick('fedavg', 'non_iid');
  const localNon = pick('local_only', 'non_iid');
  const localIid = pick('local_only', 'iid');

  if (central && fedIid) {
    out.push(`FedAvg (IID) reaches ${pct(acc(fedIid))} accuracy vs. ${pct(acc(central))} centralized — ${((acc(fedIid) / acc(central)) * 100).toFixed(1)}% of the baseline without pooling raw data.`);
  }
  if (fedIid && fedNon) {
    const diff = (acc(fedIid) - acc(fedNon)) * 100;
    out.push(`Non-IID client data changes FedAvg accuracy by ${diff >= 0 ? '−' : '+'}${Math.abs(diff).toFixed(1)} points relative to IID.`);
  }
  if (fedNon && localNon) {
    const diff = (acc(fedNon) - acc(localNon)) * 100;
    out.push(`Under non-IID data, collaboration (FedAvg) is ${diff >= 0 ? `${diff.toFixed(1)} points better` : `${Math.abs(diff).toFixed(1)} points worse`} than clients training alone (local-only mean ${pct(acc(localNon))}, std ${pct(localNon.finalMetrics.accuracy_std)}).`);
  } else if (fedIid && localIid) {
    const diff = (acc(fedIid) - acc(localIid)) * 100;
    out.push(`With IID data, FedAvg is ${diff.toFixed(1)} points ${diff >= 0 ? 'better' : 'worse'} than the local-only mean.`);
  }

  const dp = done
    .filter((e) => e.differentialPrivacy && e.dpConfig?.epsilon != null)
    .sort((a, b) => a.dpConfig.epsilon - b.dpConfig.epsilon);
  if (dp.length >= 2) {
    const lo = dp[0];
    const hi = dp[dp.length - 1];
    out.push(`Privacy–utility trade-off: ε=${lo.dpConfig.epsilon} per round gives ${pct(acc(lo))}, ε=${hi.dpConfig.epsilon} gives ${pct(acc(hi))}${fedIid ? ` (no DP: ${pct(acc(fedIid))})` : ''}.`);
  }
  return out;
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const ids = useMemo(() => (params.get('ids') || '').split(',').filter(Boolean), [params]);
  const [all, setAll] = useState<any[]>([]);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getExperiments(1, 100).then((r) => setAll(r.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (ids.length === 0) { setLoaded([]); setLoading(false); return; }
    setLoading(true);
    Promise.all(ids.map(async (id) => {
      const [experiment, rounds] = await Promise.all([
        api.getExperiment(id),
        api.getExperimentRounds(id).then((r) => r.rounds || []).catch(() => []),
      ]);
      return { experiment, rounds };
    }))
      .then(setLoaded)
      .catch(() => setLoaded([]))
      .finally(() => setLoading(false));
  }, [ids]);

  const completed = all.filter((e) => e.status === 'completed');

  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setParams(next.length ? { ids: next.join(',') } : {});
  };

  const best = useMemo(() => {
    const result: Record<string, number> = {};
    for (const { key } of METRICS) {
      const values = loaded.map((l) => l.experiment.finalMetrics?.[key]).filter((v) => v != null);
      if (values.length) result[key] = Math.max(...values);
    }
    return result;
  }, [loaded]);

  const seriesName = useMemo(() => {
    const counts: Record<string, number> = {};
    loaded.forEach((l) => { counts[l.experiment.name] = (counts[l.experiment.name] || 0) + 1; });
    const names: Record<string, string> = {};
    loaded.forEach((l) => {
      names[l.experiment.id] = counts[l.experiment.name] > 1
        ? `${l.experiment.name} (${l.experiment.id.slice(0, 4)})`
        : l.experiment.name;
    });
    return (l: Loaded) => names[l.experiment.id];
  }, [loaded]);

  const barData = METRICS.filter((m) => m.key !== 'precision').map(({ key, label }) => {
    const row: Record<string, any> = { metric: label };
    loaded.forEach((l) => { row[seriesName(l)] = l.experiment.finalMetrics?.[key]; });
    return row;
  });

  const maxRounds = Math.max(0, ...loaded.map((l) => l.rounds.length));
  const convergence = Array.from({ length: maxRounds }, (_, i) => {
    const row: Record<string, any> = { round: i + 1 };
    loaded.forEach((l) => {
      if (l.rounds.length > 1) row[seriesName(l)] = l.rounds[i]?.evalMetrics?.accuracy;
    });
    return row;
  });
  const singleRound = loaded.filter((l) => l.rounds.length <= 1 && l.experiment.finalMetrics);

  const dpCurve = completed
    .filter((e) => e.differentialPrivacy && e.dpConfig?.epsilon != null && e.finalMetrics)
    .sort((a, b) => a.dpConfig.epsilon - b.dpConfig.epsilon)
    .map((e) => ({
      epsilon: e.dpConfig.epsilon,
      accuracy: e.finalMetrics.accuracy,
      auc: e.finalMetrics.roc_auc,
    }));
  const noDpFed = completed.find((e) => e.trainingMethod === 'fedavg' && !e.differentialPrivacy && e.partitionType === 'iid');

  const keyFindings = findings(all);

  const exportCsv = () => {
    downloadFile('fedhealth-comparison.csv', toCsv(loaded.map(({ experiment: e }) => ({
      name: e.name,
      setup: methodLabel(e),
      clients: e.trainingMethod === 'centralized' ? '' : e.numClients,
      rounds: e.trainingMethod === 'centralized' ? '' : e.numRounds,
      accuracy: e.finalMetrics?.accuracy,
      precision: e.finalMetrics?.precision,
      recall: e.finalMetrics?.recall,
      f1_score: e.finalMetrics?.f1_score,
      roc_auc: e.finalMetrics?.roc_auc,
      total_epsilon: e.finalMetrics?.privacy?.cumulative_epsilon ?? '',
      communication_kb: e.finalMetrics?.total_communication_bytes != null ? (e.finalMetrics.total_communication_bytes / 1024).toFixed(1) : '',
      seed: e.randomSeed,
    }))), 'text/csv');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Compare Experiments</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">All methods are evaluated on the same held-out test split (same seed and test size).</p>
        </div>
        {loaded.length > 0 && <button onClick={exportCsv} className="btn-secondary">Export CSV</button>}
      </div>

      {keyFindings.length > 0 && (
        <div className="card mb-6 border-[var(--color-primary-200)] bg-[var(--color-primary-50)]">
          <h2 className="text-sm font-semibold text-[var(--color-primary-800)] uppercase tracking-wider mb-2">Key findings</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--color-primary-900)]">
            {keyFindings.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Select experiments</h2>
        {completed.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No completed experiments yet. <Link to="/experiments" className="text-[var(--color-primary-600)] underline">Run some first</Link>.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {completed.map((e) => (
              <label key={e.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer ${ids.includes(e.id) ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]' : 'border-[var(--color-border)]'}`}>
                <input type="checkbox" checked={ids.includes(e.id)} onChange={() => toggle(e.id)} />
                {e.name}
              </label>
            ))}
            {completed.length > 1 && (
              <button className="text-xs text-[var(--color-primary-600)] hover:underline ml-2"
                onClick={() => setParams({ ids: completed.map((e) => e.id).join(',') })}>Select all</button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div></div>
      ) : loaded.length === 0 ? (
        <div className="card text-center py-12 text-[var(--color-text-muted)]">Select at least one experiment to compare.</div>
      ) : (
        <>
          <div className="card mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                  <th className="py-3 px-2 font-medium">Experiment</th>
                  <th className="py-3 px-2 font-medium">Setup</th>
                  {METRICS.map((m) => <th key={m.key} className="py-3 px-2 font-medium">{m.label}</th>)}
                  <th className="py-3 px-2 font-medium">Total ε</th>
                  <th className="py-3 px-2 font-medium">Comm.</th>
                </tr>
              </thead>
              <tbody>
                {loaded.map(({ experiment: e }, i) => (
                  <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-3 px-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <Link to={`/experiments/${e.id}`} className="font-medium text-[var(--color-primary-600)] hover:underline">{e.name}</Link>
                    </td>
                    <td className="py-3 px-2 text-xs">{methodLabel(e)}</td>
                    {METRICS.map(({ key }) => {
                      const v = e.finalMetrics?.[key];
                      const isBest = v != null && loaded.length > 1 && v === best[key];
                      return (
                        <td key={key} className={`py-3 px-2 ${isBest ? 'font-bold text-[var(--color-success)]' : ''}`}>
                          {key === 'accuracy' ? pct(v) : num(v, 3)}
                        </td>
                      );
                    })}
                    <td className="py-3 px-2">{e.finalMetrics?.privacy?.cumulative_epsilon ?? '—'}</td>
                    <td className="py-3 px-2 text-xs">{e.finalMetrics?.total_communication_bytes ? `${(e.finalMetrics.total_communication_bytes / 1024).toFixed(1)} KB` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <div className="card">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Final test metrics</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="metric" fontSize={12} />
                    <YAxis domain={[0, 1]} fontSize={12} />
                    <Tooltip formatter={(v: number) => v?.toFixed(4)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {loaded.map((l, i) => (
                      <Bar key={l.experiment.id} dataKey={seriesName(l)} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Accuracy per round</h2>
              {maxRounds > 1 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={convergence}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="round" fontSize={12} />
                      <YAxis domain={[0.4, 0.9]} fontSize={12} />
                      <Tooltip formatter={(v: number) => v?.toFixed(4)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {singleRound.map((l) => (
                        <ReferenceLine key={l.experiment.id} y={l.experiment.finalMetrics.accuracy} stroke="#0f172a" strokeDasharray="5 5"
                          label={{ value: seriesName(l), fontSize: 10, position: 'insideTopRight' }} />
                      ))}
                      {loaded.map((l, i) => l.rounds.length > 1 && (
                        <Line key={l.experiment.id} type="monotone" dataKey={seriesName(l)} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">Select a federated or local-only experiment to see convergence.</p>
              )}
            </div>
          </div>

          <div className="card mb-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Confusion matrices</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loaded.filter((l) => l.experiment.finalMetrics?.confusion_matrix).map(({ experiment: e }) => {
                const [[tn, fp], [fn, tp]] = e.finalMetrics.confusion_matrix;
                return (
                  <div key={e.id} className="p-3 rounded-lg border border-[var(--color-border)]">
                    <p className="text-xs font-medium mb-2 truncate" title={e.name}>{e.name}</p>
                    <div className="grid grid-cols-2 gap-1 text-center font-mono text-sm">
                      <div className="p-2 rounded bg-green-50 text-green-800" title="True negatives">{tn}</div>
                      <div className="p-2 rounded bg-red-50 text-red-800" title="False positives">{fp}</div>
                      <div className="p-2 rounded bg-red-50 text-red-800" title="False negatives">{fn}</div>
                      <div className="p-2 rounded bg-green-50 text-green-800" title="True positives">{tp}</div>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">rows: true 0/1 · cols: predicted 0/1</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {dpCurve.length >= 2 && (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Privacy–utility trade-off</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">All completed FedAvg + DP experiments. Lower ε = stronger privacy.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dpCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="epsilon" type="number" scale="log" domain={['auto', 'auto']} fontSize={12}
                  label={{ value: 'ε per round (log scale)', position: 'insideBottom', offset: -2, fontSize: 12 }} />
                <YAxis domain={[0.4, 0.9]} fontSize={12} />
                <Tooltip formatter={(v: number) => v?.toFixed(4)} labelFormatter={(l) => `ε = ${l}`} />
                <Legend />
                {noDpFed && (
                  <ReferenceLine y={noDpFed.finalMetrics.accuracy} stroke="#64748b" strokeDasharray="5 5"
                    label={{ value: 'FedAvg without DP', fontSize: 10, position: 'insideBottomRight' }} />
                )}
                <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="auc" name="ROC-AUC" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
