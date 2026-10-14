import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { methodLabel, num, pct, statusBadge } from '@/lib/format';

interface ExperimentForm {
  name: string;
  datasetId: string;
  trainingMethod: 'centralized' | 'local_only' | 'fedavg';
  partitionType: 'none' | 'iid' | 'non_iid';
  numClients: number;
  numRounds: number;
  localEpochs: number;
  learningRate: number;
  batchSize: number;
  randomSeed: number;
  testSize: number;
  differentialPrivacy: boolean;
  dpEpsilon: number;
  dpDelta: number;
  dpClipNorm: number;
}

const DEFAULT_FORM: ExperimentForm = {
  name: '',
  datasetId: '',
  trainingMethod: 'fedavg',
  partitionType: 'iid',
  numClients: 5,
  numRounds: 20,
  localEpochs: 5,
  learningRate: 0.1,
  batchSize: 32,
  randomSeed: 42,
  testSize: 0.2,
  differentialPrivacy: false,
  dpEpsilon: 1,
  dpDelta: 1e-5,
  dpClipNorm: 1,
};

type Preset = { label: string; values: Partial<ExperimentForm> };

const PRESETS: Preset[] = [
  { label: 'Centralized baseline', values: { name: 'Centralized baseline', trainingMethod: 'centralized', partitionType: 'none', differentialPrivacy: false } },
  { label: 'FedAvg · IID', values: { name: 'FedAvg IID', trainingMethod: 'fedavg', partitionType: 'iid', differentialPrivacy: false } },
  { label: 'FedAvg · Non-IID', values: { name: 'FedAvg Non-IID', trainingMethod: 'fedavg', partitionType: 'non_iid', differentialPrivacy: false } },
  { label: 'Local only · Non-IID', values: { name: 'Local only Non-IID', trainingMethod: 'local_only', partitionType: 'non_iid', differentialPrivacy: false } },
  { label: 'FedAvg + DP (ε=1)', values: { name: 'FedAvg IID + DP eps=1', trainingMethod: 'fedavg', partitionType: 'iid', differentialPrivacy: true, dpEpsilon: 1 } },
];

const BENCHMARK_SUITE: Partial<ExperimentForm>[] = [
  { name: 'Centralized baseline', trainingMethod: 'centralized', partitionType: 'none' },
  { name: 'FedAvg IID', trainingMethod: 'fedavg', partitionType: 'iid' },
  { name: 'FedAvg Non-IID', trainingMethod: 'fedavg', partitionType: 'non_iid' },
  { name: 'Local only IID', trainingMethod: 'local_only', partitionType: 'iid' },
  { name: 'Local only Non-IID', trainingMethod: 'local_only', partitionType: 'non_iid' },
  ...[0.5, 1, 5, 10].map((eps) => ({
    name: `FedAvg IID + DP eps=${eps}`,
    trainingMethod: 'fedavg' as const,
    partitionType: 'iid' as const,
    differentialPrivacy: true,
    dpEpsilon: eps,
  })),
];

function toPayload(form: ExperimentForm) {
  const centralized = form.trainingMethod === 'centralized';
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    datasetId: form.datasetId,
    trainingMethod: form.trainingMethod,
    partitionType: centralized ? 'none' : form.partitionType === 'none' ? 'iid' : form.partitionType,
    randomSeed: Number(form.randomSeed),
    testSize: Number(form.testSize),
  };
  if (!centralized) {
    Object.assign(payload, {
      numClients: Number(form.numClients),
      numRounds: Number(form.numRounds),
      localEpochs: Number(form.localEpochs),
      learningRate: Number(form.learningRate),
      batchSize: Number(form.batchSize),
    });
  }
  if (form.trainingMethod === 'fedavg' && form.differentialPrivacy) {
    payload.differentialPrivacy = true;
    payload.dpConfig = {
      epsilon: Number(form.dpEpsilon),
      delta: Number(form.dpDelta),
      clipNorm: Number(form.dpClipNorm),
    };
  }
  return payload;
}

function NumberField({ label, value, onChange, min, max, step, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" className="input" value={value} min={min} max={max} step={step ?? 1}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

export default function ExperimentsPage() {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ExperimentForm>(DEFAULT_FORM);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [datasetsLoaded, setDatasetsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [suiteRunning, setSuiteRunning] = useState(false);

  const validDatasets = datasets.filter((d) => d.status === 'valid');

  const loadExperiments = useCallback(() => {
    return api.getExperiments(1, 100)
      .then(setExperiments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadExperiments();
    api.getDatasets(1, 100).then((r) => {
      const items = r.items || [];
      setDatasets(items);
      const firstValid = items.find((d: any) => d.status === 'valid');
      if (firstValid) setForm((f) => (f.datasetId ? f : { ...f, datasetId: firstValid.id }));
    }).catch(() => {}).finally(() => setDatasetsLoaded(true));
  }, [loadExperiments]);

  const hasActive = experiments?.items?.some((e: any) => e.status === 'queued' || e.status === 'running');
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(loadExperiments, 2000);
    return () => clearInterval(timer);
  }, [hasActive, loadExperiments]);

  const set = <K extends keyof ExperimentForm>(key: K, value: ExperimentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const applyPreset = (preset: Preset) => {
    setForm((f) => ({ ...f, ...preset.values }));
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.datasetId) { setError('Select a valid dataset first'); return; }
    setCreating(true);
    setError('');
    try {
      await api.createExperiment(toPayload(form));
      setShowForm(false);
      setForm((f) => ({ ...DEFAULT_FORM, datasetId: f.datasetId }));
      loadExperiments();
    } catch (err: any) {
      setError(err.message || 'Failed to create experiment');
    } finally {
      setCreating(false);
    }
  };

  const runSuite = async () => {
    if (!form.datasetId) { setError('Upload and validate a dataset first'); return; }
    setSuiteRunning(true);
    setError('');
    try {
      for (const exp of BENCHMARK_SUITE) {
        await api.createExperiment(toPayload({ ...DEFAULT_FORM, datasetId: form.datasetId, ...exp } as ExperimentForm));
      }
      loadExperiments();
    } catch (err: any) {
      setError(err.message || 'Failed to start benchmark suite');
    } finally {
      setSuiteRunning(false);
    }
  };

  const toggleSelected = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const isCentralized = form.trainingMethod === 'centralized';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Experiments</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Centralized vs. local vs. federated learning, with optional differential privacy</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={runSuite} disabled={suiteRunning || validDatasets.length === 0} className="btn-secondary"
            title="Runs centralized, FedAvg (IID / non-IID), local-only, and FedAvg+DP at 4 privacy levels">
            {suiteRunning ? 'Starting…' : '▶ Run benchmark suite'}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Close' : '+ New experiment'}
          </button>
        </div>
      </div>

      {validDatasets.length === 0 && datasetsLoaded && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          No valid dataset yet. <Link to="/datasets" className="font-medium underline">Upload the PIMA CSV</Link> first.
        </div>
      )}

      {error && !showForm && <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="card mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mr-1">Presets</span>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => applyPreset(p)} className="btn-secondary text-xs py-1 px-2">
                {p.label}
              </button>
            ))}
          </div>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="label">Name</label>
                <input type="text" className="input" value={form.name} maxLength={200}
                  onChange={(e) => set('name', e.target.value)} placeholder="FedAvg IID" />
              </div>
              <div>
                <label className="label">Dataset</label>
                <select className="input" value={form.datasetId} onChange={(e) => set('datasetId', e.target.value)}>
                  <option value="">Select dataset…</option>
                  {datasets.map((ds) => (
                    <option key={ds.id} value={ds.id} disabled={ds.status !== 'valid'}>{ds.name} ({ds.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Training method</label>
                <select className="input" value={form.trainingMethod}
                  onChange={(e) => {
                    const method = e.target.value as ExperimentForm['trainingMethod'];
                    setForm((f) => ({
                      ...f,
                      trainingMethod: method,
                      partitionType: method === 'centralized' ? 'none' : f.partitionType === 'none' ? 'iid' : f.partitionType,
                      differentialPrivacy: method === 'fedavg' ? f.differentialPrivacy : false,
                    }));
                  }}>
                  <option value="centralized">Centralized (pooled data)</option>
                  <option value="fedavg">FedAvg (federated)</option>
                  <option value="local_only">Local only (no collaboration)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <NumberField label="Random seed" value={form.randomSeed} min={0} max={999999} onChange={(v) => set('randomSeed', v)} />
              <NumberField label="Test size" value={form.testSize} min={0.1} max={0.4} step={0.05} onChange={(v) => set('testSize', v)} hint="Held out, never seen by clients" />
            </div>

            {!isCentralized && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Federated setup</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div>
                    <label className="label">Partition</label>
                    <select className="input" value={form.partitionType} onChange={(e) => set('partitionType', e.target.value as ExperimentForm['partitionType'])}>
                      <option value="iid">IID</option>
                      <option value="non_iid">Non-IID</option>
                    </select>
                  </div>
                  <NumberField label="Clients" value={form.numClients} min={2} max={20} onChange={(v) => set('numClients', v)} />
                  <NumberField label="Rounds" value={form.numRounds} min={1} max={100} onChange={(v) => set('numRounds', v)} />
                  <NumberField label="Local epochs" value={form.localEpochs} min={1} max={50} onChange={(v) => set('localEpochs', v)} />
                  <NumberField label="Learning rate" value={form.learningRate} min={0.001} max={1} step={0.01} onChange={(v) => set('learningRate', v)} />
                  <NumberField label="Batch size" value={form.batchSize} min={8} max={256} onChange={(v) => set('batchSize', v)} />
                </div>
                {form.partitionType === 'non_iid' && (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">Non-IID uses Dirichlet label skew (α = 0.5): clients see very different diabetic/non-diabetic ratios.</p>
                )}
              </div>
            )}

            {form.trainingMethod === 'fedavg' && (
              <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={form.differentialPrivacy} onChange={(e) => set('differentialPrivacy', e.target.checked)} />
                  Differential privacy (Gaussian mechanism on client updates)
                </label>
                {form.differentialPrivacy && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <NumberField label="ε per round" value={form.dpEpsilon} min={0.05} max={100} step={0.5} onChange={(v) => set('dpEpsilon', v)} hint="Lower = more private, more noise" />
                    <NumberField label="δ per round" value={form.dpDelta} min={1e-10} max={0.01} step={0.00001} onChange={(v) => set('dpDelta', v)} />
                    <NumberField label="Clip norm (C)" value={form.dpClipNorm} min={0.01} max={100} step={0.1} onChange={(v) => set('dpClipNorm', v)} hint="Max L2 norm of each client update" />
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={creating} className="btn-primary px-6">
              {creating ? 'Starting…' : 'Start experiment'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold">All experiments</h2>
          <button className="btn-primary text-xs" disabled={selected.length < 2}
            onClick={() => navigate(`/compare?ids=${selected.join(',')}`)}>
            Compare selected ({selected.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div>
          </div>
        ) : experiments?.items?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                  <th className="py-3 px-2 w-8"></th>
                  <th className="py-3 px-2 font-medium">Name</th>
                  <th className="py-3 px-2 font-medium">Setup</th>
                  <th className="py-3 px-2 font-medium">Status</th>
                  <th className="py-3 px-2 font-medium">Accuracy</th>
                  <th className="py-3 px-2 font-medium">F1</th>
                  <th className="py-3 px-2 font-medium">ROC-AUC</th>
                  <th className="py-3 px-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {experiments.items.map((exp: any) => (
                  <tr key={exp.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-secondary)]">
                    <td className="py-3 px-2">
                      <input type="checkbox" aria-label={`Select ${exp.name}`} disabled={exp.status !== 'completed'}
                        checked={selected.includes(exp.id)} onChange={() => toggleSelected(exp.id)} />
                    </td>
                    <td className="py-3 px-2">
                      <Link to={`/experiments/${exp.id}`} className="font-medium text-[var(--color-primary-600)] hover:underline">{exp.name}</Link>
                    </td>
                    <td className="py-3 px-2 text-xs">{methodLabel(exp)}</td>
                    <td className="py-3 px-2">
                      <span className={`badge ${statusBadge(exp.status)}`}>
                        {exp.status === 'running' && <span className="status-dot status-dot-running mr-1.5" />}
                        {exp.status}
                      </span>
                    </td>
                    <td className="py-3 px-2">{pct(exp.finalMetrics?.accuracy)}</td>
                    <td className="py-3 px-2">{num(exp.finalMetrics?.f1_score, 3)}</td>
                    <td className="py-3 px-2">{num(exp.finalMetrics?.roc_auc, 3)}</td>
                    <td className="py-3 px-2 text-[var(--color-text-muted)]">{exp.durationSeconds != null ? `${exp.durationSeconds.toFixed(1)}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2">🔬</p>
            <p>No experiments yet. Pick a preset or run the benchmark suite.</p>
          </div>
        )}
      </div>
    </div>
  );
}
