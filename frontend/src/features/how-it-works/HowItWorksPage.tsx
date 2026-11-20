import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { pct } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import FederationRoundInspector, { type TraceRound } from '@/components/FederationRoundInspector';

interface ExperimentSummary {
  id: string;
  name: string;
  status: string;
  trainingMethod: string;
  differentialPrivacy: boolean;
  randomSeed: number;
  createdAt: string;
  finalMetrics?: {
    accuracy?: number;
    num_train_samples?: number;
    num_validation_samples?: number;
    num_test_samples?: number;
    evaluation_protocol?: string;
  };
}

export default function HowItWorksPage() {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [rounds, setRounds] = useState<TraceRound[]>([]);
  const [illustrative, setIllustrative] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.getExperiments(1, 100).then((result) => {
      if (!current) return;
      const completed = (result.items as ExperimentSummary[] || [])
        .filter((exp) => exp.status === 'completed' && exp.trainingMethod === 'fedavg')
        .sort((a, b) => Number(!!b.finalMetrics?.evaluation_protocol) - Number(!!a.finalMetrics?.evaluation_protocol)
          || Number(a.differentialPrivacy) - Number(b.differentialPrivacy)
          || b.createdAt.localeCompare(a.createdAt));
      setExperiments(completed);
      setSelectedId(completed[0]?.id ?? '');
      setIllustrative(!completed[0]?.finalMetrics?.evaluation_protocol);
    }).catch((err: Error) => { if (current) setError(err.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);

  useEffect(() => {
    if (!selectedId) return;
    let current = true;
    setRounds([]);
    setError('');
    setLoadingRounds(true);
    api.getExperimentRounds(selectedId).then((result) => { if (current) setRounds(result.rounds ?? []); })
      .catch((err: Error) => { if (current) setError(err.message); })
      .finally(() => { if (current) setLoadingRounds(false); });
    return () => { current = false; };
  }, [selectedId, retry]);

  const selected = experiments.find((exp) => exp.id === selectedId);
  const metrics = selected?.finalMetrics;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Research / The learning loop" title="Architecture lab" description="Start with the same untrained model. Learn at each hospital. Inspect the updates and verify the average." />

      <div className="card"><ArchitectureDiagram /></div>

      <details className="card space-y-4">
        <summary className="text-base font-medium cursor-pointer">How does an untrained model learn? A worked example.</summary>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="federation-stat">
            <p className="font-semibold">1. An empty rule, not a patient database</p>
            <p className="mt-2">Our logistic regression starts with w = 0 and b = 0. For any input, p = sigmoid(w·x + b) = 0.5. All hospitals receive the same 9 numbers.</p>
          </div>
          <div className="federation-stat">
            <p className="font-semibold">2. Local labels tell it how to change</p>
            <p className="mt-2">A local patient row supplies features x and known outcome y. SGD computes prediction error p − y, then updates the weights using this error and x. Those rows stay with the local trainer.</p>
          </div>
          <div className="federation-stat">
            <p className="font-semibold">3. FedAvg combines what changed</p>
            <p className="mt-2">Different hospitals learn different coefficient changes from their own records. FedAvg averages these changes by sample count. The resulting global model becomes the shared starting point of the next round.</p>
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium">Show one local learning step with simple numbers</summary>
          <div className="mt-3 rounded-lg bg-[var(--color-surface-secondary)] p-4 text-sm space-y-2">
            <p><b>Illustrative one-feature example:</b> standardized x = 2, label y = 1, w = 0, b = 0, learning rate = 0.1.</p>
            <p className="font-mono">p = sigmoid(0) = 0.5; error = 0.5 − 1 = −0.5</p>
            <p className="font-mono">w′ = 0 − 0.1 × (2 × −0.5) = 0.1</p>
            <p className="font-mono">b′ = 0 − 0.1 × (−0.5) = 0.05</p>
            <p>The hospital sends the changes Δw = 0.1 and Δb = 0.05. It does not send x = 2 or y = 1. Actual training uses 8 features, mini-batches, several epochs and a small L2 penalty.</p>
          </div>
        </details>
      </details>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button className={illustrative ? 'btn-primary' : 'btn-secondary'} onClick={() => setIllustrative(true)}>Learn with an example</button>
          <button className={!illustrative ? 'btn-primary' : 'btn-secondary'} onClick={() => setIllustrative(false)} disabled={!experiments.length || loading}>Inspect an actual run</button>
        </div>
        {!illustrative && <label className="text-sm">Completed FedAvg experiment
          <select className="input mt-1 max-w-full sm:max-w-md" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {experiments.map((exp) => <option key={exp.id} value={exp.id}>{exp.name} · seed {exp.randomSeed}{exp.finalMetrics?.evaluation_protocol ? '' : ' · legacy'}</option>)}
          </select>
        </label>}
      </div>

      {error && <div className="card text-sm text-red-700" role="alert">{error} <button className="underline ml-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
      {!loading && !experiments.length && <p className="text-sm text-[var(--color-text-secondary)]">The example works before any experiment is run. <Link className="underline text-[var(--color-primary-600)]" to="/experiments">Run a FedAvg experiment</Link> to inspect real recorded updates here.</p>}

      {!illustrative && loadingRounds
        ? <div className="card text-sm" role="status">Loading recorded round updates…</div>
        : <FederationRoundInspector key={`${illustrative}-${selectedId}`} rounds={rounds} illustrative={illustrative} />}

      {!illustrative && metrics && <div className="card">
        <h2 className="font-semibold mb-3">Evaluation is separate from learning</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-[var(--color-text-muted)]">Training records</p><p className="text-xl font-bold">{metrics.num_train_samples ?? '—'}</p></div>
          <div><p className="text-[var(--color-text-muted)]">Validation records</p><p className="text-xl font-bold">{metrics.num_validation_samples ?? 'Legacy: no separate validation'}</p></div>
          <div><p className="text-[var(--color-text-muted)]">Final test records</p><p className="text-xl font-bold">{metrics.num_test_samples ?? '—'}</p></div>
          <div><p className="text-[var(--color-text-muted)]">Final test accuracy</p><p className="text-xl font-bold">{pct(metrics.accuracy)}</p></div>
        </div>
        <Link className="inline-block mt-4 text-sm underline text-[var(--color-primary-600)]" to={`/experiments/${selectedId}`}>Open full results, split manifest and exports</Link>
      </div>}

      <p className="text-xs text-[var(--color-text-muted)]">Research simulator using a public PIMA dataset. Simulated clients share a process and preprocessing statistics. No clinical validity or certified differential privacy is claimed.</p>
    </div>
  );
}
