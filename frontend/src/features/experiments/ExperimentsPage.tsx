import { useState, useEffect, useCallback, useId } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icon';
import api from '@/lib/api';
import { methodLabel, num, pct, statusBadge } from '@/lib/format';
import { PIMA_FEATURE_FIELDS } from '@/lib/pima';

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
  balanceClasses: boolean;
  differentialPrivacy: boolean;
  optimizeModel: boolean;
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
  balanceClasses: true,
  differentialPrivacy: false,
  optimizeModel: false,
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
    balanceClasses: form.balanceClasses,
    optimizeModel: form.optimizeModel,
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
  min: number; max: number; step?: number | 'any'; hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type="number" required className="input" value={value} min={min} max={max} step={step ?? 1}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

export default function ExperimentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [experiments, setExperiments] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [form, setForm] = useState<ExperimentForm>(() => searchParams.get('goal') === 'prediction'
    ? {...DEFAULT_FORM, name:'Improved prediction model', trainingMethod:'centralized', partitionType:'none', optimizeModel:true}
    : {...DEFAULT_FORM, name:'Federated hospital model'});
  const [datasets, setDatasets] = useState<any[]>([]);
  const [datasetsLoaded, setDatasetsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [suiteRunning, setSuiteRunning] = useState(false);
  const [suiteBalanced, setSuiteBalanced] = useState(true);

  const validDatasets = datasets.filter((d) => d.status === 'valid');
  const selectedDataset = validDatasets.find((dataset) => dataset.id === form.datasetId);

  const loadExperiments = useCallback(() => {
    return api.getExperiments(1, 100)
      .then(setExperiments)
      .catch((error: Error) => setError(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadExperiments();
    api.getDatasets(1, 100).then((r) => {
      const items = r.items || [];
      setDatasets(items);
    }).catch(() => setError('Could not load training datasets. Refresh to try again.')).finally(() => setDatasetsLoaded(true));
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
    setForm((f) => ({ ...f, ...preset.values, optimizeModel: false }));
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!selectedDataset) { setError('Choose the labeled dataset to use for training.'); return; }
    setCreating(true);
    setError('');
    try {
      const created = await api.createExperiment(toPayload(form));
      setShowForm(false);
      setForm((f) => ({ ...DEFAULT_FORM, datasetId: f.datasetId }));
      loadExperiments();
      navigate(`/experiments/${created.id}`);
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
        await api.createExperiment(toPayload({
          ...DEFAULT_FORM,
          datasetId: form.datasetId,
          ...exp,
          name: suiteBalanced ? `${exp.name} (balanced)` : exp.name,
          balanceClasses: suiteBalanced,
        } as ExperimentForm));
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

  const items = experiments?.items ?? [];
  const hasModern = items.some((exp: any) => exp.finalMetrics?.evaluation_protocol);
  const visible = items.filter((exp: any) =>
    exp.name.toLowerCase().includes(search.toLowerCase())
    && (status === 'all' || exp.status === status)
    && (includeLegacy || !hasModern || exp.status !== 'completed' || exp.finalMetrics?.evaluation_protocol),
  );
  return <div>
    <PageHeader eyebrow="Research / Training" title="Train your model" description="Choose the labeled CSV to learn from, select a training method, and start. Training settings have ready-to-use defaults." actions={<button className={showForm ? 'btn-secondary' : 'btn-primary'} onClick={() => setShowForm(!showForm)}><Icon name={showForm ? 'close' : 'plus'} size={17}/>{showForm ? 'Hide training form' : 'Train model'}</button>} />
    {error && <div className="form-feedback" role="alert">{error}<button className="underline ml-3" onClick={() => { setError(''); loadExperiments(); }}>Refresh</button></div>}
    {!validDatasets.length && datasetsLoaded && <div className="card mb-6 flex items-center justify-between gap-4"><div><h2 className="font-medium">Prepare a dataset first</h2><p className="text-sm text-[var(--color-text-muted)] mt-1">Training needs a validated PIMA-format CSV.</p></div><Link to="/datasets" className="btn-secondary">Add dataset</Link></div>}
    {showForm && <section className="card mb-7"><div className="section-heading"><div><h2>Train from a labeled dataset</h2><p>The CSV supplies the measurements and known outcomes. The experiment name only labels your run.</p></div><Icon name="flask" size={22}/></div>
      <form onSubmit={handleCreate} onInvalidCapture={event => { for (let ancestor: HTMLElement|null = event.target as HTMLElement; ancestor; ancestor = ancestor.parentElement) { if(ancestor.tagName==='DETAILS') ancestor.setAttribute('open',''); } }} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Training goal">
          <button type="button" className="training-choice" aria-pressed={form.trainingMethod !== 'centralized'} onClick={()=>setForm(current=>({...DEFAULT_FORM,datasetId:current.datasetId,name:'Federated hospital model'}))}><Icon name="network" size={22}/><strong>Federated hospital model</strong><span>Simulated hospitals train one shared model through local parameter updates.</span></button>
          <button type="button" className="training-choice" aria-pressed={form.trainingMethod === 'centralized'} onClick={()=>setForm(current=>({...DEFAULT_FORM,datasetId:current.datasetId,name:'Improved prediction model',trainingMethod:'centralized',partitionType:'none',optimizeModel:true}))}><Icon name="pulse" size={22}/><strong>Prediction baseline</strong><span>Compare model families with cross-validation. Centralized training, separately labeled.</span></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="label" htmlFor="experiment-dataset">Training data (labeled CSV)</label><select id="experiment-dataset" className="input" value={form.datasetId} onChange={(event) => set('datasetId',event.target.value)} required aria-describedby="training-data-summary"><option value="">Choose the dataset to train on</option>{validDatasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}{dataset.numRows!=null?` - ${dataset.numRows.toLocaleString()} records`:''}</option>)}</select><Link to="/datasets" className="section-link inline-block text-xs mt-2">Upload or review a dataset</Link></div><div><label className="label" htmlFor="experiment-name">Experiment name</label><input id="experiment-name" className="input" value={form.name} onChange={(event) => set('name',event.target.value)} placeholder="A name for this training run" required maxLength={200}/></div></div>
        <div id="training-data-summary" className="rounded-lg border border-[var(--color-border)] p-4 text-sm" aria-live="polite">{selectedDataset?<><p className="font-medium">Training input: {selectedDataset.name}</p><p className="text-[var(--color-text-secondary)] mt-2 leading-relaxed">{selectedDataset.numRows!=null?`${selectedDataset.numRows.toLocaleString()} labeled records`:'Labeled CSV records'}{selectedDataset.filename?` from ${selectedDataset.filename}`:''}. Each row has eight measurements and a known Outcome: 0 or 1.</p><p className="text-[var(--color-text-secondary)] mt-2 leading-relaxed">{isCentralized?'Training uses the development records together. A separate test set measures the final model.':`Training records are divided among ${form.numClients} simulated hospitals. ${form.trainingMethod==='local_only'?'Each hospital trains its own model independently.':'Each hospital learns locally; FedAvg receives parameter updates and sample counts.'} A separate test set measures the final result.`}</p><details className="mt-3"><summary className="cursor-pointer text-xs font-medium">See input columns and target</summary><p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed"><strong>Inputs:</strong> {PIMA_FEATURE_FIELDS.map(field=>field.name).join(', ')}.<br/><strong>Known answer:</strong> Outcome, already present in the CSV.</p></details></>:<p className="text-[var(--color-text-secondary)]">Choose a dataset above to see what the model will learn from. For an estimate for one person, use <Link to="/assess" className="section-link">New assessment</Link>.</p>}</div>
        <details className="border-t border-[var(--color-border)] pt-5"><summary className="text-sm font-medium cursor-pointer">Advanced training settings (optional)</summary><div className="space-y-6 mt-5">
          <div className="flex gap-2 flex-wrap">{PRESETS.map((preset) => <button className="btn-secondary text-xs" type="button" key={preset.label} onClick={() => applyPreset(preset)}>{preset.label}</button>)}</div>
          {isCentralized && <label className="flex gap-3 items-center text-sm"><input type="checkbox" checked={form.optimizeModel} onChange={event=>set('optimizeModel',event.target.checked)}/>Compare prediction models automatically using development-data CV</label>}
        <div><label className="label" htmlFor="experiment-method">Learning method</label><select id="experiment-method" className="input" value={form.trainingMethod} onChange={(event) => { const method=event.target.value as ExperimentForm['trainingMethod']; setForm((current) => ({...current,trainingMethod:method,partitionType:method==='centralized'?'none':current.partitionType==='none'?'iid':current.partitionType,differentialPrivacy:method==='fedavg'?current.differentialPrivacy:false})); }}><option value="fedavg">Federated averaging — hospitals share parameter updates</option><option value="centralized">Centralized baseline — pooled training data</option><option value="local_only">Local only — each hospital learns independently</option></select></div>
        {!isCentralized && <div className="grid grid-cols-1 sm:grid-cols-3 gap-5"><div><label className="label" htmlFor="experiment-partition">Hospital distribution</label><select id="experiment-partition" className="input" value={form.partitionType} onChange={(event) => set('partitionType',event.target.value as ExperimentForm['partitionType'])}><option value="iid">IID — similar distributions</option><option value="non_iid">Non-IID — different class distributions</option></select></div><NumberField label="Hospitals" value={form.numClients} min={2} max={20} onChange={(value) => set('numClients',value)}/><NumberField label="Communication rounds" value={form.numRounds} min={1} max={100} onChange={(value) => set('numRounds',value)}/></div>}
        <label className="flex gap-3 items-start text-sm"><input type="checkbox" disabled={form.optimizeModel} checked={form.balanceClasses} onChange={(event) => set('balanceClasses',event.target.checked)} className="mt-1"/><span>Balance the training classes<span className="block text-xs text-[var(--color-text-muted)] mt-1">Give the minority class more weight. This may improve recall while changing precision.</span></span></label>
        <details className="border-t border-[var(--color-border)] pt-5"><summary className="text-sm font-medium cursor-pointer">Reproducibility and advanced settings</summary><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5"><NumberField label="Random seed" value={form.randomSeed} min={0} max={999999} onChange={(value)=>set('randomSeed',value)}/><NumberField label="Final test fraction" value={form.testSize} min={0.1} max={0.4} step={0.05} onChange={(value)=>set('testSize',value)} hint="20% of the remaining pool is reserved for validation."/>{!isCentralized && <><NumberField label="Local epochs" value={form.localEpochs} min={1} max={50} onChange={(value)=>set('localEpochs',value)}/><NumberField label="Learning rate" value={form.learningRate} min={0.001} max={1} step={0.001} onChange={(value)=>set('learningRate',value)}/><NumberField label="Batch size" value={form.batchSize} min={8} max={256} onChange={(value)=>set('batchSize',value)}/></>}</div></details>
        {form.trainingMethod==='fedavg' && <details className="border-t border-[var(--color-border)] pt-5"><summary className="text-sm font-medium cursor-pointer">Optional update clipping and noise</summary><label className="flex gap-3 text-sm items-center mt-5"><input type="checkbox" checked={form.differentialPrivacy} onChange={(event)=>set('differentialPrivacy',event.target.checked)}/>Enable the educational Gaussian-noise mechanism</label>{form.differentialPrivacy && <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5"><NumberField label="Epsilon per round" value={form.dpEpsilon} min={0.05} max={100} step={0.05} onChange={(value)=>set('dpEpsilon',value)}/><NumberField label="Delta per round" value={form.dpDelta} min={1e-10} max={0.01} step="any" onChange={(value)=>set('dpDelta',value)}/><NumberField label="Clip norm" value={form.dpClipNorm} min={0.01} max={100} step={0.01} onChange={(value)=>set('dpClipNorm',value)}/></div>}<p className="text-xs text-[var(--color-text-muted)] mt-4">Seeded noise explores the utility trade-off. It is not a certified differential privacy guarantee.</p></details>}
        </div></details>
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[var(--color-border)]"><button type="submit" disabled={creating||!selectedDataset} className="btn-primary"><Icon name="play" size={15}/>{creating?'Starting experiment…':'Start training'}</button><p className="text-xs text-[var(--color-text-muted)]">{form.optimizeModel?'Automatic comparison - development CV - separate final test':`${form.numClients} simulated hospitals - separate final test`}</p></div>
      </form>
    </section>}
    <details className="mb-7"><summary className="text-sm text-[var(--color-text-secondary)] cursor-pointer py-3">Advanced: run the full research comparison</summary><section className="card"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-base font-medium">Run a controlled comparison</h2><p className="text-sm text-[var(--color-text-muted)] mt-2">Nine methods and noise settings. Same dataset, seed and 20-round schedule.</p></div><div className="flex flex-wrap items-center gap-4"><label className="flex gap-2 items-center text-xs text-[var(--color-text-secondary)]"><input type="checkbox" checked={suiteBalanced} onChange={(event)=>setSuiteBalanced(event.target.checked)} disabled={suiteRunning}/>Balanced classes</label><button className="btn-secondary" onClick={runSuite} disabled={suiteRunning||!selectedDataset}><Icon name="flask" size={16}/>{suiteRunning?'Starting suite…':'Run comparison suite'}</button></div></div></section></details>
    <details><summary className="text-sm font-medium cursor-pointer py-3">Previous training runs</summary><section className="card"><div className="section-heading"><div><h2>Experiment library</h2><p>{visible.length} shown · select completed runs to compare</p></div><div className="flex gap-2">{selected.length>0 && <button className="btn-quiet" onClick={()=>setSelected([])}>Clear selection</button>}<button className="btn-secondary" disabled={selected.length<2} onClick={()=>navigate(`/compare?ids=${selected.join(',')}`)}><Icon name="chart" size={16}/>Compare selected{selected.length>0?` (${selected.length})`:''}</button></div></div><div className="table-toolbar"><label className="search-field"><Icon name="search" size={16}/><input placeholder="Search experiments" aria-label="Search experiments" value={search} onChange={(event)=>setSearch(event.target.value)}/></label><div className="flex flex-wrap items-center gap-4"><label className="flex gap-2 text-xs items-center text-[var(--color-text-secondary)]"><input type="checkbox" checked={includeLegacy} onChange={(event)=>setIncludeLegacy(event.target.checked)}/>Include legacy runs</label><select className="input w-auto min-w-36" aria-label="Filter experiment status" value={status} onChange={(event)=>setStatus(event.target.value)}>{['all','completed','running','queued','failed','cancelled'].map((value)=><option key={value} value={value}>{value==='all'?'All statuses':value.charAt(0).toUpperCase()+value.slice(1)}</option>)}</select></div></div>
      {loading?<div className="empty-state" role="status">Loading experiments…</div>:visible.length?<div className="overflow-x-auto"><table><thead><tr className="text-left border-b border-[var(--color-border)]"><th className="w-8"></th><th>Experiment</th><th>Method</th><th>Status</th><th>Test accuracy</th><th>F1</th><th>ROC-AUC</th></tr></thead><tbody>{visible.map((exp:any)=><tr key={exp.id} className="border-b border-[var(--color-border)] last:border-0"><td className="pr-3"><input type="checkbox" aria-label={`Select ${exp.name}`} disabled={exp.status!=='completed'} checked={selected.includes(exp.id)} onChange={()=>toggleSelected(exp.id)}/></td><td className="pr-5 min-w-56"><Link to={`/experiments/${exp.id}`} className="text-[var(--color-text-primary)]">{exp.name}</Link><p className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(exp.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {exp.finalMetrics?.evaluation_protocol?.includes('cv3')?'CV + final test':exp.finalMetrics?.evaluation_protocol?'v2 evaluation':exp.status==='completed'?'Legacy evaluation':'Awaiting results'}</p></td><td className="text-xs pr-4 min-w-32">{methodLabel(exp)}</td><td className="pr-5"><span className={`badge ${statusBadge(exp.status)}`}>{exp.status==='running'&&<span className="status-dot status-dot-running"/>}{exp.status}</span></td><td className="font-medium tabular-nums pr-4">{pct(exp.finalMetrics?.accuracy)}</td><td className="tabular-nums pr-4">{num(exp.finalMetrics?.f1_score,3)}</td><td className="tabular-nums">{num(exp.finalMetrics?.roc_auc,3)}</td></tr>)}</tbody></table></div>:<div className="empty-state"><Icon name="flask" size={30}/><h3>{items.length?'No runs match these filters':'Your experiments will appear here'}</h3><p>{items.length?'Try another search, status or include legacy runs.':'Build your first experiment or run the comparison suite.'}</p></div>}
    </section></details>
  </div>;
}
