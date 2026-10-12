import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function ModelsPage() {
  const [models, setModels] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getModels().then(setModels).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Model Registry</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Trained models and their evaluation summaries</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div></div>
        ) : models?.items?.length > 0 ? (
          <div className="space-y-4">
            {models.items.map((model: any) => (
              <div key={model.id} className="p-4 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{model.modelId || model.modelVersion}</h3>
                  <span className={`badge ${model.status === 'ready' ? 'badge-success' : model.status === 'training' ? 'badge-warning' : 'badge-neutral'}`}>
                    {model.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-[var(--color-text-muted)]">Type:</span> <span className="font-medium">{model.modelType}</span></div>
                  <div><span className="text-[var(--color-text-muted)]">Method:</span> <span className="font-medium capitalize">{model.trainingMethod?.replace('_', ' ')}</span></div>
                  <div><span className="text-[var(--color-text-muted)]">Accuracy:</span> <span className="font-medium">{model.metrics?.accuracy != null ? `${(model.metrics.accuracy * 100).toFixed(1)}%` : '—'}</span></div>
                  <div><span className="text-[var(--color-text-muted)]">Created:</span> <span className="font-medium">{new Date(model.createdAt).toLocaleDateString()}</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2">🧠</p>
            <p>No models registered yet. Models appear here after experiments complete successfully.</p>
          </div>
        )}
      </div>
    </div>
  );
}
