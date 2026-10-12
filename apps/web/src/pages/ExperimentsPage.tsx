import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', datasetId: '', trainingMethod: 'centralized',
    numClients: 5, partitionType: 'none', numRounds: 10,
    randomSeed: 42, testSize: 0.2,
  });
  const [datasets, setDatasets] = useState<any[]>([]);
  const [error, setError] = useState('');

  const loadExperiments = () => {
    setLoading(true);
    api.getExperiments(1, 50).then(setExperiments).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExperiments();
    api.getDatasets(1, 100).then((r) => setDatasets(r.items || [])).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.createExperiment({
        ...form,
        numClients: Number(form.numClients),
        numRounds: Number(form.numRounds),
        randomSeed: Number(form.randomSeed),
        testSize: Number(form.testSize),
      });
      setShowForm(false);
      loadExperiments();
    } catch (err: any) {
      setError(err.message || 'Failed to create experiment');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Experiments</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Configure and run ML experiments</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] transition-colors">
          {showForm ? 'Cancel' : '+ New Experiment'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-4">New Experiment</h2>
          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]/20 focus:border-[var(--color-primary-500)]"
                placeholder="Centralized Baseline v1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Dataset</label>
              <select value={form.datasetId} onChange={(e) => setForm({ ...form, datasetId: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]/20">
                <option value="">Select dataset...</option>
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id} disabled={ds.status !== 'valid'}>{ds.name} ({ds.status})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Training Method</label>
              <select value={form.trainingMethod} onChange={(e) => setForm({ ...form, trainingMethod: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm">
                <option value="centralized">Centralized</option>
                <option value="local_only">Local Only</option>
                <option value="fedavg">FedAvg (Federated)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Random Seed</label>
              <input type="number" value={form.randomSeed} onChange={(e) => setForm({ ...form, randomSeed: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm" min={0} max={999999} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Test Size</label>
              <input type="number" value={form.testSize} onChange={(e) => setForm({ ...form, testSize: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm" min={0.05} max={0.5} step={0.05} />
            </div>
            {form.trainingMethod !== 'centralized' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Clients</label>
                  <input type="number" value={form.numClients} onChange={(e) => setForm({ ...form, numClients: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm" min={2} max={20} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Partition</label>
                  <select value={form.partitionType} onChange={(e) => setForm({ ...form, partitionType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm">
                    <option value="iid">IID</option>
                    <option value="non_iid">Non-IID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Rounds</label>
                  <input type="number" value={form.numRounds} onChange={(e) => setForm({ ...form, numRounds: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm" min={1} max={100} />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <button type="submit" disabled={creating}
                className="px-6 py-2.5 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-50">
                {creating ? 'Creating...' : 'Start Experiment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Experiments list */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
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
                  <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">F1</th>
                  <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">ROC-AUC</th>
                  <th className="text-left py-3 px-2 font-medium text-[var(--color-text-muted)]">Duration</th>
                </tr>
              </thead>
              <tbody>
                {experiments.items.map((exp: any) => (
                  <tr key={exp.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-secondary)]">
                    <td className="py-3 px-2">
                      <Link to={`/experiments/${exp.id}`} className="font-medium text-[var(--color-primary-600)] hover:underline">
                        {exp.name}
                      </Link>
                    </td>
                    <td className="py-3 px-2 capitalize">{exp.trainingMethod?.replace('_', ' ')}</td>
                    <td className="py-3 px-2">
                      <span className={`badge ${
                        exp.status === 'completed' ? 'badge-success' : exp.status === 'running' ? 'badge-warning' :
                        exp.status === 'failed' ? 'badge-error' : exp.status === 'queued' ? 'badge-info' : 'badge-neutral'
                      }`}>{exp.status}</span>
                    </td>
                    <td className="py-3 px-2">{exp.finalMetrics?.accuracy != null ? `${(exp.finalMetrics.accuracy * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-3 px-2">{exp.finalMetrics?.f1_score != null ? exp.finalMetrics.f1_score.toFixed(4) : '—'}</td>
                    <td className="py-3 px-2">{exp.finalMetrics?.roc_auc != null ? exp.finalMetrics.roc_auc.toFixed(4) : '—'}</td>
                    <td className="py-3 px-2 text-[var(--color-text-muted)]">{exp.durationSeconds != null ? `${exp.durationSeconds.toFixed(1)}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2">🔬</p>
            <p>No experiments yet. Create your first experiment above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
