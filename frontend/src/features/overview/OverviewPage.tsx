import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { modelMethodLabel, pct } from '@/lib/format';
import Icon from '@/components/ui/Icon';
import PageHeader from '@/components/ui/PageHeader';


interface Model { modelId: string; modelVersion: string; isActive: boolean; trainingMethod: string; experimentId?: string; metrics?: { accuracy?: number; recall?: number; roc_auc?: number; num_train_samples?: number; num_test_samples?: number; optimization?: {selected?: {estimator?: string}}; evaluation_protocol?: string } }
interface Prediction { id: string; riskLevel: string; probability: number; createdAt: string; trainingMethod: string }

export default function OverviewPage() {
  const { user } = useAuth();
  const researcher = user?.role === 'researcher' || user?.role === 'admin';

  const [experimentTotal, setExperimentTotal] = useState(0);
  const [datasetCount, setDatasetCount] = useState(0);
  const [activeModel, setActiveModel] = useState<Model | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predictionTotal, setPredictionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true; setLoading(true); setError('');
    const load = async () => {
      try {
        if (researcher) {
          const [exps, datasets, models] = await Promise.all([api.getExperiments(1, 100), api.getDatasets(1, 100), api.getModels(1, 100)]);
          if (!current) return;
          setExperimentTotal(exps.total ?? 0);
          setDatasetCount((datasets.items ?? []).filter((d: { status: string }) => d.status === 'valid').length);
          setActiveModel((models.items ?? []).find((m: Model) => m.isActive) ?? null);
        } else {
          const result = await api.getPredictions(1, 5); if (!current) return;
          setPredictions(result.items ?? []); setPredictionTotal(result.total ?? 0);
        }
      } catch (error) { if (current) setError(error instanceof Error ? error.message : 'Workspace data could not be loaded.'); }
      finally { if (current) setLoading(false); }
    }; load(); return () => { current = false; };
  }, [researcher, retry]);

  const latest = predictions[0];
  const display = (value: string | number) => loading || error ? '—' : value;
  return <div>
    <PageHeader eyebrow={researcher ? 'Research workspace' : 'Your personal workspace'} title={researcher ? 'Your research workspace' : `Welcome, ${user?.firstName ?? ''}.`} description={researcher ? 'Train a model, check the results, and try an assessment.' : 'Make a research assessment, understand the result, and keep your history in one place.'} actions={<Link className="btn-primary" to={researcher ? '/experiments?new=1' : '/assess'}><Icon name="plus" size={17} />{researcher ? 'Train model' : 'New assessment'}</Link>} />
    {error && <div className="form-feedback flex items-center justify-between gap-3" role="alert">{error}<button onClick={() => setRetry((n) => n + 1)} className="btn-secondary">Try again</button></div>}
    {researcher ? <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">{[
        {number:'01',title:'Train a model',text:'Choose federated learning or compare prediction models. Select a validated dataset to get started.',to:'/experiments',icon:'flask' as const},
        {number:'02',title:'See the results',text:'Read the test score and understand what the model gets right or misses.',to:'/compare',icon:'chart' as const},
        {number:'03',title:'Try an assessment',text:'Use a sample or enter measurements. Save the result with its model version.',to:'/assess',icon:'pulse' as const},
      ].map(step=><Link className="card workflow-simple" to={step.to} key={step.number}><span className="text-xs text-[var(--color-text-muted)]">{step.number}</span><Icon name={step.icon} size={23}/><h2 className="text-lg font-medium">{step.title}</h2><p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{step.text}</p></Link>)}</div>
      <div className="patient-overview"><section className="card"><div className="section-heading"><div><h2>Model used for assessments</h2><p>The active model generates every new estimate.</p></div><Icon name="layers" size={21}/></div>{loading?<p role="status" className="text-sm">Loading the current model-</p>:activeModel?<><span className="badge badge-neutral">{modelMethodLabel(activeModel.trainingMethod)}{activeModel.metrics?.optimization?.selected?.estimator?' - '+activeModel.metrics.optimization.selected.estimator.replace(/Classifier$/,'').replace(/([a-z])([A-Z])/g,'$1 $2'):''}</span><div className="grid grid-cols-3 gap-4 my-7"><div><p className="text-xs text-[var(--color-text-muted)]">Test accuracy</p><p className="text-3xl mt-2">{pct(activeModel.metrics?.accuracy)}</p></div><div><p className="text-xs text-[var(--color-text-muted)]">Recall</p><p className="text-3xl mt-2">{pct(activeModel.metrics?.recall)}</p></div><div><p className="text-xs text-[var(--color-text-muted)]">Test records</p><p className="text-3xl mt-2">{activeModel.metrics?.num_test_samples??'-'}</p></div></div><p className="text-xs font-mono text-[var(--color-text-muted)] break-all mb-5">Version {activeModel.modelVersion}</p><div className="flex flex-wrap gap-3"><Link to="/assess" className="btn-primary">Try this model</Link><Link to="/experiments?new=1&goal=prediction" className="btn-secondary">Train an improved predictor</Link></div></>:<p className="text-sm">Train a model and select it in the model registry to enable assessments.</p>}</section><section className="card"><Icon name="play" size={24}/><h2 className="text-xl font-medium mt-5">Start with reliable data.</h2><p className="text-sm text-[var(--color-text-secondary)] my-4 leading-relaxed">Upload a labeled CSV, review its validation, then select it when starting a training run. Your data needs eight measurements and an Outcome label for each record.</p><Link to="/datasets" className="btn-secondary">Review training data</Link><p className="text-xs text-[var(--color-text-muted)] mt-5 leading-relaxed">The prediction baseline uses centralized training and is labeled separately from the federated experiment.</p></section></div>
      <p className="text-sm text-[var(--color-text-muted)] mt-6">{loading?'Loading research history-':`${experimentTotal} saved training runs - ${datasetCount} validated dataset${datasetCount===1?'':'s'}`}. Detailed experiments and model controls are under Advanced tools.</p>
    </> : <><div className="metric-strip" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}><div className="metric-item"><p className="metric-label">Your assessments</p><p className="metric-value">{display(predictionTotal)}</p><p className="metric-note">Saved privately to your account</p></div><div className="metric-item"><p className="metric-label">Latest research estimate</p><p className="metric-value">{display(latest ? pct(latest.probability) : 'None yet')}</p><p className="metric-note">{latest ? `${latest.riskLevel} risk · ${new Date(latest.createdAt).toLocaleDateString()}` : 'Complete an assessment to see a result'}</p></div></div><div className="patient-overview"><section className="card"><Icon name="pulse" size={27} /><h2 className="text-xl font-medium mt-5">Understand your measurements.</h2><p className="text-sm text-[var(--color-text-secondary)] my-4 leading-relaxed">Enter eight measurements for a research estimate. You’ll see which model produced it, and every result stays in your history.</p><Link to="/assess" className="btn-primary">Start an assessment</Link></section><section className="card"><div className="section-heading"><h2>Recent assessments</h2><Link to="/history" className="section-link">View history</Link></div>{predictions.length ? predictions.map((p) => <div className="small-definition" key={p.id}><span>{new Date(p.createdAt).toLocaleDateString()}</span><span>{p.riskLevel} · {pct(p.probability)}</span></div>) : <p className="text-sm text-[var(--color-text-muted)]">Your assessment history will appear here.</p>}</section></div></>}
    <div className="research-note"><Icon name="info" size={15} /><p>Research simulation using public data. Hospital clients share one process; predictions are research estimates and have no established clinical validity.</p></div>
  </div>;
}
