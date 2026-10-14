import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDatasets = () => {
    setLoading(true);
    api.getDatasets().then(setDatasets).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadDatasets(); }, []);

  const pending = datasets?.items?.some((d: any) => d.status === 'pending' || d.status === 'validating');
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => api.getDatasets().then(setDatasets).catch(() => {}), 1500);
    return () => clearInterval(timer);
  }, [pending]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      await api.uploadDataset(file, file.name, '');
      loadDatasets();
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Datasets</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Upload and validate research datasets</p>
        </div>
      </div>

      {/* Upload form */}
      <div className="card mb-6">
        <h2 className="text-base font-semibold mb-3">Upload Dataset</h2>
        <form onSubmit={handleUpload} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">CSV File</label>
            <input ref={fileRef} type="file" accept=".csv" required
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--color-primary-50)] file:text-[var(--color-primary-700)] file:font-medium file:cursor-pointer hover:file:bg-[var(--color-primary-100)]" />
          </div>
          <button type="submit" disabled={uploading}
            className="px-4 py-2.5 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
        {uploadError && <p className="mt-2 text-sm text-[var(--color-error)]">{uploadError}</p>}
      </div>

      {/* Dataset list */}
      <div className="card">
        <h2 className="text-base font-semibold mb-4">Registered Datasets</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div>
          </div>
        ) : datasets?.items?.length > 0 ? (
          <div className="space-y-3">
            {datasets.items.map((ds: any) => (
              <div key={ds.id} className="p-4 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{ds.name}</h3>
                  <span className={`badge ${ds.status === 'valid' ? 'badge-success' : ds.status === 'invalid' ? 'badge-error' : ds.status === 'validating' ? 'badge-warning' : 'badge-neutral'}`}>
                    {ds.status}
                  </span>
                </div>
                <div className="flex gap-6 text-xs text-[var(--color-text-muted)]">
                  <span>{ds.numRows ? `${ds.numRows} rows` : 'Pending'}</span>
                  <span>{(ds.fileSize / 1024).toFixed(1)} KB</span>
                  <span>{new Date(ds.createdAt).toLocaleDateString()}</span>
                  {ds.classBalance != null && <span>Balance: {(ds.classBalance * 100).toFixed(1)}%</span>}
                </div>
                {ds.validationResult?.errors?.length > 0 && (
                  <ul className="mt-2 text-xs text-[var(--color-error)] list-disc pl-4">
                    {ds.validationResult.errors.map((e: string) => <li key={e}>{e}</li>)}
                  </ul>
                )}
                {ds.validationResult?.warnings?.length > 0 && (
                  <details className="mt-2 text-xs text-amber-700">
                    <summary className="cursor-pointer">⚠️ {ds.validationResult.warnings.length} warning(s)</summary>
                    <ul className="list-disc pl-4 mt-1">
                      {ds.validationResult.warnings.map((w: string) => <li key={w}>{w}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2">📁</p>
            <p>No datasets uploaded yet. Upload a CSV file to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
