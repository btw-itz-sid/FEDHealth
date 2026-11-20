import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icon';
import { evaluationKey } from '@/lib/evaluation';
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
    out.push(`In these selected runs, FedAvg (IID) test accuracy is ${pct(acc(fedIid))} and centralized test accuracy is ${pct(acc(central))}. These are measured research results, not clinical accuracy claims.`);
  }
  if (fedIid && fedNon) {
    const diff = (acc(fedIid) - acc(fedNon)) * 100;
    out.push(Math.abs(diff) < 0.05
      ? 'IID and non-IID FedAvg have the same test accuracy to one decimal place in these runs; compare recall and F1 as well.'
      : `Non-IID client data changes FedAvg accuracy by ${diff >= 0 ? '−' : '+'}${Math.abs(diff).toFixed(1)} points relative to IID.`);
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
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [includeLegacy, setIncludeLegacy] = useState(false);

  useEffect(() => {
    api.getExperiments(1, 100).then((r) => { setAll(r.items || []); if (!params.get('ids')) { const latest = (r.items || []).find((e: any) => e.status === 'completed'); if (latest) setParams({ids:latest.id}, {replace:true}); } }).catch((error: Error) => setError(error.message));
  }, []);

  useEffect(() => {
    if (ids.length === 0) { setLoaded([]); setLoading(false); return; }
    let current = true;
    setLoading(true); setError('');
    Promise.all(ids.map(async (id) => {
      const [experiment, rounds] = await Promise.all([
        api.getExperiment(id),
        api.getExperimentRounds(id).then((r) => r.rounds || []).catch(() => []),
      ]);
      return { experiment, rounds };
    }))
      .then((result) => { if(current) setLoaded(result); })
      .catch((error: Error) => { if(current) { setLoaded([]); setError(error.message); } })
      .finally(() => { if(current) setLoading(false); });
    return () => { current = false; };
  }, [ids]);

  const completed = all.filter((e) => e.status === 'completed');
  const hasModern = completed.some((e) => e.finalMetrics?.evaluation_protocol);
  const candidates = completed.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) && (includeLegacy || !hasModern || e.finalMetrics?.evaluation_protocol || ids.includes(e.id)));
  const comparable = new Set(loaded.map((l) => evaluationKey(l.experiment))).size <= 1
    && new Set(loaded.filter((l) => l.experiment.trainingMethod !== 'centralized').map(({ experiment: e }) =>
      JSON.stringify([e.numClients, e.numRounds, e.localEpochs, e.learningRate, e.batchSize]),
    )).size <= 1;

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

  const selectedExperiments = loaded.map((l) => l.experiment);
  const dpReference = selectedExperiments.find((e) => e.differentialPrivacy);
  const sameDpSetup = (e: any) => dpReference && evaluationKey(e) === evaluationKey(dpReference)
    && e.partitionType === dpReference.partitionType && e.numClients === dpReference.numClients
    && e.numRounds === dpReference.numRounds && e.localEpochs === dpReference.localEpochs
    && e.learningRate === dpReference.learningRate && e.batchSize === dpReference.batchSize
    && (!e.differentialPrivacy || (e.dpConfig?.delta === dpReference.dpConfig?.delta
      && e.dpConfig?.clipNorm === dpReference.dpConfig?.clipNorm));
  const dpCurve = selectedExperiments
    .filter(sameDpSetup)
    .filter((e) => e.differentialPrivacy && e.dpConfig?.epsilon != null && e.finalMetrics)
    .sort((a, b) => a.dpConfig.epsilon - b.dpConfig.epsilon)
    .map((e) => ({
      epsilon: e.dpConfig.epsilon,
      accuracy: e.finalMetrics.accuracy,
      auc: e.finalMetrics.roc_auc,
    }));
  const noDpFed = selectedExperiments.find((e) => e.trainingMethod === 'fedavg' && !e.differentialPrivacy && sameDpSetup(e));

  const keyFindings = comparable ? findings(selectedExperiments) : [];

  const exportCsv = () => {
    downloadFile('fedhealth-comparison.csv', toCsv(loaded.map(({ experiment: e }) => ({
      name: e.name,
      setup: methodLabel(e),
      balanced_classes: e.balanceClasses ? 'yes' : 'no',
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
      evaluation_protocol: e.finalMetrics?.evaluation_protocol ?? 'legacy_train_test_v1',
      train_samples: e.finalMetrics?.num_train_samples,
      validation_samples: e.finalMetrics?.num_validation_samples ?? '',
      test_samples: e.finalMetrics?.num_test_samples,
    }))), 'text/csv');
  };

  return (
    <div>
      <PageHeader eyebrow="Research / Evaluation" title="Model results" description="See how the latest model performed on records kept apart from training." actions={loaded.length > 0 ? <button onClick={exportCsv} className="btn-secondary"><Icon name="download" size={16}/>Export comparison</button> : undefined} />

      {error && <div className="form-feedback" role="alert">{error}</div>}
      {!loading && keyFindings.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-primary-800)] uppercase tracking-wider mb-2">Key findings</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--color-primary-900)]">
            {keyFindings.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      {!loading && loaded.length===1 && <section className="card mb-6"><span className="badge badge-neutral">{methodLabel(loaded[0].experiment)}</span><h2 className="text-xl font-medium mt-4">{loaded[0].experiment.name}</h2><div className="grid grid-cols-3 gap-4 my-7">{[{key:'accuracy',label:'Accuracy',text:'Share of test records classified correctly.'},{key:'recall',label:'Recall',text:'Share of positive cases identified.'},{key:'f1_score',label:'F1 score',text:'Balance between precision and recall.'}].map(metric=><div key={metric.key}><p className="text-sm text-[var(--color-text-muted)]">{metric.label}</p><p className="text-3xl my-2">{metric.key==='f1_score'?num(loaded[0].experiment.finalMetrics?.[metric.key],3):pct(loaded[0].experiment.finalMetrics?.[metric.key])}</p><p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{metric.text}</p></div>)}</div><p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">Measured on {loaded[0].experiment.finalMetrics?.num_test_samples??'held-out'} test records. {loaded[0].experiment.finalMetrics?.optimization?'Configuration was chosen with development-data cross-validation, then refit before final test scoring.':'Training and final test records are separate.'}</p><div className="flex flex-wrap gap-3 mt-6"><Link to="/assess" className="btn-primary">Try an assessment</Link><Link to={`/experiments/${loaded[0].experiment.id}`} className="btn-secondary">View training evidence</Link></div></section>}
      <details open={ids.length>1}><summary className="text-sm font-medium cursor-pointer py-4">Advanced: compare runs, charts and confusion matrices</summary>
      <section className="card mb-6">
        <div className="section-heading"><div><h2>Choose the evidence</h2><p>{ids.length} selected · match dataset, seed, class balancing and training settings</p></div>{ids.length>0&&<button className="btn-quiet" onClick={()=>setParams({})}>Clear selection</button>}</div>
        <div className="table-toolbar"><label className="search-field"><Icon name="search" size={16}/><input aria-label="Search comparison experiments" placeholder="Find a completed run" value={search} onChange={(event)=>setSearch(event.target.value)}/></label><label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]"><input type="checkbox" checked={includeLegacy} onChange={(event)=>setIncludeLegacy(event.target.checked)}/>Include legacy runs</label></div>
        {candidates.length?<div className="max-h-64 overflow-auto"><table><thead><tr className="text-left"><th className="w-8"></th><th>Completed experiment</th><th>Protocol</th><th>Test accuracy</th></tr></thead><tbody>{candidates.map((exp)=><tr key={exp.id} className="border-b border-[var(--color-border)] last:border-0"><td><input type="checkbox" id={`compare-${exp.id}`} aria-label={`Compare ${exp.name} (${exp.id.slice(0,6)})`} checked={ids.includes(exp.id)} onChange={()=>toggle(exp.id)}/></td><td className="pr-4"><label className="cursor-pointer text-sm" htmlFor={`compare-${exp.id}`}>{exp.name}</label></td><td><span className="badge badge-neutral">{exp.finalMetrics?.evaluation_protocol?.includes('cv3')?'CV + test':exp.finalMetrics?.evaluation_protocol?'v2':'Legacy'}</span></td><td className="tabular-nums">{pct(exp.finalMetrics?.accuracy)}</td></tr>)}</tbody></table></div>:<div className="empty-state"><Icon name="chart" size={26}/><h3>No matching completed runs</h3><p>Run the comparison suite, or adjust the filters.</p><Link className="btn-secondary" to="/experiments">Open experiments</Link></div>}
      </section>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div></div>
      ) : loaded.length === 0 ? (
        <div className="card text-center py-12 text-[var(--color-text-muted)]">Select at least one experiment to compare.</div>
      ) : (
        <>
          {!comparable && <div className="card mb-6 text-sm bg-amber-50 text-amber-900" role="alert">These runs use different datasets, seeds, class balancing, evaluation splits or local training settings. Values are shown for inspection; automatic findings and best-score highlights are disabled. Re-run the methods with matching settings for a fair comparison.</div>}
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
                      const isBest = comparable && v != null && loaded.length > 1 && v === best[key];
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
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Validation accuracy per round (test for legacy runs)</h2>
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
                        <ReferenceLine key={l.experiment.id} y={l.experiment.finalMetrics.validation_metrics?.accuracy ?? l.experiment.finalMetrics.accuracy} stroke="#0f172a" strokeDasharray="5 5"
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
          <p className="text-xs text-[var(--color-text-muted)] mb-3">Selected runs with matching data, evaluation, partition and optimizer settings. Smaller ε adds more noise in this educational mechanism; it is not a certified privacy guarantee.</p>
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
                <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#3d6c63" strokeWidth={2} />
                <Line type="monotone" dataKey="auc" name="ROC-AUC" stroke="#a28c61" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </details>
    </div>
  );
}
