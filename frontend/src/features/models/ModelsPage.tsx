import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { modelMethodLabel, num, pct } from '@/lib/format';

export default function ModelsPage() {
  const [models, setModels] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    return api.getModels(1, 100).then(setModels).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const activate = async (id: string) => {
    setActivating(id);
    setError('');
    try {
      await api.activateModel(id);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to activate model');
    } finally {
      setActivating(null);
    }
  };

  const items: any[] = models?.items || [];
  const active = items.find((m) => m.isActive);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Model Registry</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Trained models. The <strong>active</strong> model serves every patient risk assessment.
        </p>
      </div>

      {active && (
        <div className="card mb-6 border-green-200 bg-green-50">
          <p className="text-xs font-medium text-green-800 uppercase tracking-wider mb-1">Serving patient predictions</p>
          <p className="font-semibold text-green-900">
            {modelMethodLabel(active.trainingMethod)} · accuracy {pct(active.metrics?.accuracy)} · ROC-AUC {num(active.metrics?.roc_auc, 3)}
          </p>
          <p className="text-xs font-mono text-green-800 mt-1">{active.modelId}</p>
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div></div>
        ) : items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                  <th className="py-3 px-2 font-medium">Model</th>
                  <th className="py-3 px-2 font-medium">Method</th>
                  <th className="py-3 px-2 font-medium">Accuracy</th>
                  <th className="py-3 px-2 font-medium">F1</th>
                  <th className="py-3 px-2 font-medium">ROC-AUC</th>
                  <th className="py-3 px-2 font-medium">Created</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((model) => (
                  <tr key={model.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-secondary)]">
                    <td className="py-3 px-2">
                      <p className="font-mono text-xs">{model.modelId}</p>
                      {model.experimentId && (
                        <Link to={`/experiments/${model.experimentId}`} className="text-xs text-[var(--color-primary-600)] hover:underline">View experiment</Link>
                      )}
                    </td>
                    <td className="py-3 px-2">{modelMethodLabel(model.trainingMethod)}</td>
                    <td className="py-3 px-2">{pct(model.metrics?.accuracy)}</td>
                    <td className="py-3 px-2">{num(model.metrics?.f1_score, 3)}</td>
                    <td className="py-3 px-2">{num(model.metrics?.roc_auc, 3)}</td>
                    <td className="py-3 px-2 text-[var(--color-text-muted)]">{new Date(model.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-2 text-right">
                      {model.isActive ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <button onClick={() => activate(model.id)} disabled={activating !== null} className="btn-secondary text-xs py-1">
                          {activating === model.id ? 'Activating…' : 'Use for predictions'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2">🧠</p>
            <p>No models yet. Centralized and FedAvg experiments register a model when they complete.</p>
          </div>
        )}
      </div>
    </div>
  );
}
