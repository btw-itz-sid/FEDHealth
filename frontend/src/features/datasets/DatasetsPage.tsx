import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { PIMA_FEATURE_FIELDS } from '@/lib/pima';
import { downloadFile } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icon';

interface Dataset { id: string; name: string; status: string; numRows?: number; fileSize: number; classBalance?: number; createdAt: string; validationResult?: { errors?: string[]; warnings?: string[] } }
export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try { const response = await api.getDatasets(1, 100); setDatasets(response.items ?? []); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load datasets.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const pending = datasets.some((d) => ['pending', 'validating'].includes(d.status));
  useEffect(() => { if (!pending) return; const timer = setInterval(load, 1800); return () => clearInterval(timer); }, [pending, load]);
  const choose = (chosen?: File) => { if (!chosen) return; setError(''); if (!chosen.name.toLowerCase().endsWith('.csv')) { setError('Choose a CSV file. ZIP archives need to be unpacked first.'); return; } if (chosen.size > 5 * 1024 * 1024) { setError('Choose a CSV no larger than 5 MB.'); return; } setFile(chosen); };
  const upload = async () => {
    if (!file) return; setUploading(true); setError('');
    try { await api.uploadDataset(file, file.name, ''); setFile(null); if (fileRef.current) fileRef.current.value = ''; await load(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Upload failed. Please try again.'); }
    finally { setUploading(false); }
  };
  return <div>
    <PageHeader eyebrow="Research / Data preparation" title="Datasets" description="Shared research workspace. Upload a labeled CSV you have permission to use, then review its validation before training." actions={<button className="btn-secondary" onClick={() => downloadFile('fedhealth-pima-template.csv', [...PIMA_FEATURE_FIELDS.map((f) => f.name), 'Outcome'].join(',') + '\n', 'text/csv')}><Icon name="download" size={16} />Download CSV schema</button>} />
    {error && <div className="form-feedback" role="alert">{error} <button className="underline ml-2" onClick={() => { setError(''); load(); }}>Retry loading</button></div>}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-7"><section className="card xl:col-span-2"><div className="section-heading"><div><h2>Add a research dataset</h2><p>CSV format · up to 5 MB · PIMA schema</p></div><Icon name="upload" size={20} /></div><div className={`dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!uploading) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!uploading) choose(event.dataTransfer.files[0]); }}><Icon name={file ? 'file' : 'upload'} size={29} className="mx-auto text-[var(--color-text-muted)]" /><p className="font-medium mt-4">{file ? file.name : 'Drop your CSV here'}</p><p className="text-sm text-[var(--color-text-muted)] mt-2 mb-5">{file ? `${(file.size / 1024).toFixed(1)} KB · ready to upload and validate` : 'Or choose a file from your computer.'}</p><input type="file" accept=".csv" ref={fileRef} className="sr-only" aria-label="Choose CSV dataset" onChange={(event) => choose(event.target.files?.[0])} disabled={uploading} /><div className="flex flex-wrap justify-center gap-3"><button className="btn-secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>{file ? 'Choose another file' : 'Browse files'}</button>{file && <button onClick={upload} className="btn-primary" disabled={uploading}>{uploading ? 'Uploading and validating…' : 'Upload dataset'}</button>}</div></div></section>
    <aside className="card"><p className="eyebrow">The data contract</p><h2 className="text-lg font-medium">Eight features. One outcome.</h2><p className="text-sm text-[var(--color-text-secondary)] mt-3 leading-relaxed">Use the original column names. The outcome must be 0 or 1. Invalid zero measurements are handled by the training pipeline.</p><div className="flex flex-wrap gap-1.5 mt-5">{[...PIMA_FEATURE_FIELDS.map((f) => f.name), 'Outcome'].map((name) => <span className="badge badge-neutral" key={name}>{name}</span>)}</div><p className="text-xs text-[var(--color-text-muted)] mt-5 leading-relaxed">Another diabetes dataset may use different definitions, units or labels. Validate compatibility before combining sources.</p></aside></div>
    <section className="card"><div className="section-heading"><div><h2>Dataset library</h2><p>{datasets.length} registered {datasets.length === 1 ? 'dataset' : 'datasets'} · available to approved researchers</p></div><button className="icon-button" onClick={load} aria-label="Refresh datasets"><Icon name="refresh" size={17} /></button></div>{loading ? <p className="text-sm text-[var(--color-text-muted)] py-8" role="status">Loading dataset library…</p> : datasets.length ? datasets.map((dataset) => <div key={dataset.id} className="dataset-list-item"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><Icon name="database" className="text-[var(--color-text-muted)] mt-1" /><div><h3 className="text-sm font-medium">{dataset.name}</h3><p className="text-xs text-[var(--color-text-muted)] mt-2">{dataset.numRows?.toLocaleString() ?? 'Validating'} records · {(dataset.fileSize/1024).toFixed(1)} KB · added {new Date(dataset.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p></div></div><span className={`badge ${dataset.status === 'valid' ? 'badge-success' : dataset.status === 'invalid' ? 'badge-error' : 'badge-neutral'}`}>{dataset.status === 'valid' ? 'Ready for training' : dataset.status}</span></div>{dataset.classBalance != null && <p className="text-xs text-[var(--color-text-muted)] mt-3 ml-8">Positive-class share: {(dataset.classBalance*100).toFixed(1)}%</p>}{!!dataset.validationResult?.errors?.length && <div className="form-feedback mt-4 mb-0">{dataset.validationResult.errors.map((message) => <p key={message}>{message}</p>)}</div>}{!!dataset.validationResult?.warnings?.length && <details className="ml-8 mt-3 text-xs text-[var(--color-text-secondary)]"><summary className="cursor-pointer">{dataset.validationResult.warnings.length} data quality notes</summary><ul className="list-disc pl-4 space-y-2 mt-3">{dataset.validationResult.warnings.map((message) => <li key={message}>{message}</li>)}</ul></details>}</div>) : <div className="empty-state"><Icon name="database" size={30} /><h3>No datasets yet</h3><p>Choose a CSV above. Validation will show whether it is ready for the current model.</p></div>}</section>
  </div>;
}
