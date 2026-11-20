import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { PIMA_FEATURE_FIELDS, SAMPLE_PATIENTS } from '@/lib/pima';
import { modelMethodLabel } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Icon from '@/components/ui/Icon';

type Values = Record<string, string>;
interface Assessment { probability: number; riskLevel: string; trainingMethod: string; modelVersion: string }
function validate(values: Values): Record<string,string> {
  const errors: Record<string,string> = {};
  for (const field of PIMA_FEATURE_FIELDS) {
    const raw=values[field.name]; const value=Number(raw);
    if (!raw?.trim()) errors[field.name]='Enter a value.';
    else if (!Number.isFinite(value)||value<field.min||value>field.max) errors[field.name]=`Use a number between ${field.min} and ${field.max}.`;
  }
  return errors;
}
export default function AssessPage() {
  const [values,setValues]=useState<Values>({});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [result,setResult]=useState<Assessment|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const completed=PIMA_FEATURE_FIELDS.filter((field)=>{const raw=values[field.name];const value=Number(raw);return raw?.trim()&&Number.isFinite(value)&&value>=field.min&&value<=field.max;}).length;
  const fillSample=(sample:Record<string,number>)=>{setValues(Object.fromEntries(Object.entries(sample).map(([key,value])=>[key,String(value)])));setErrors({});setError('');setResult(null);};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();const found=validate(values);setErrors(found);setError('');
    if(Object.keys(found).length){document.getElementById(Object.keys(found)[0])?.focus();return;}
    setSubmitting(true);setResult(null);
    try{setResult(await api.createPrediction(Object.fromEntries(PIMA_FEATURE_FIELDS.map((field)=>[field.name,Number(values[field.name])]))));}
    catch(error){setError(error instanceof Error?error.message:'The assessment could not be completed.');}
    finally{setSubmitting(false);}
  };
  const renderField=(name:string)=>{
    const field=PIMA_FEATURE_FIELDS.find((item)=>item.name===name)!;
    return <div key={name}><label htmlFor={name} className="label">{field.label}{field.unit&&<span className="text-[var(--color-text-muted)] font-normal"> · {field.unit}</span>}</label><input id={name} type="number" inputMode="decimal" min={field.min} max={field.max} step="any" value={values[name]??''} onChange={(event)=>{setValues((current)=>({...current,[name]:event.target.value}));setResult(null);setErrors((current)=>{const next={...current};delete next[name];return next;});}} className={`input ${errors[name]?'input-error':''}`} placeholder={`${field.min} – ${field.max}`} aria-invalid={!!errors[name]} aria-describedby={`${name}-hint`} disabled={submitting}/><p id={`${name}-hint`} className={`text-xs mt-2 leading-relaxed ${errors[name]?'text-[var(--color-error)]':'text-[var(--color-text-muted)]'}`}>{errors[name]??`${field.description}${field.zeroMeansUnknown?' · Use 0 when unknown.':''}`}</p></div>;
  };
  return <div>
    <PageHeader eyebrow="Assessments / New estimate" title="Research assessment" description="Eight measurements, one traceable estimate. The active model and its version are recorded with every result." actions={<Link to="/history" className="btn-secondary"><Icon name="clock" size={16}/>View history</Link>}/>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start"><form onSubmit={submit} noValidate className="card xl:col-span-2"><div className="section-heading"><div><h2>Enter the measurements</h2><p>Enter your measurements, or try an example to explore the result.</p></div><span className="badge badge-neutral">{completed} / 8 complete</span></div><div className="flex flex-wrap gap-2 pb-6 mb-6 border-b border-[var(--color-border)]">{Object.entries(SAMPLE_PATIENTS).map(([label,sample])=><button type="button" className="btn-secondary text-xs" onClick={()=>fillSample(sample)} disabled={submitting} key={label}><Icon name="file" size={14}/>{label}</button>)}</div>
      <p className="eyebrow">Profile & family history</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">{['Age','Pregnancies','DiabetesPedigreeFunction'].map(renderField)}</div><p className="eyebrow">Health measurements</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{['Glucose','BloodPressure','BMI','Insulin','SkinThickness'].map(renderField)}</div>
      {error&&<div className="form-feedback mt-6 mb-0" role="alert">{error}</div>}
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] mt-7 pt-6"><button type="submit" disabled={submitting} className="btn-primary"><Icon name="pulse" size={17}/>{submitting?'Generating estimate…':'Generate research estimate'}</button><button type="button" className="btn-quiet" disabled={submitting} onClick={()=>{setValues({});setErrors({});setResult(null);setError('');}}>Clear form</button></div>
    </form>
    <aside className="space-y-5"><section className="card assessment-result" aria-live="polite" aria-busy={submitting}>{result?<><div className="section-heading mb-0"><h2>Research estimate</h2><Icon name="pulse" size={20}/></div><p className="result-probability">{(result.probability*100).toFixed(1)}<span className="text-2xl ml-1">%</span></p><span className="badge badge-neutral">{result.riskLevel} risk band</span><div className="h-1.5 rounded-full bg-[var(--color-surface-tertiary)] mt-7 overflow-hidden"><div className="h-full bg-[var(--color-primary-600)] rounded-full" style={{width:`${result.probability*100}%`}}/></div><p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">The app’s research bands are &lt;30%, 30–60% and ≥60%. These are not clinical thresholds.</p><dl className="mt-5"><div className="small-definition"><dt>Training method</dt><dd>{modelMethodLabel(result.trainingMethod)}</dd></div><div className="small-definition"><dt>Model version</dt><dd className="font-mono break-all">{result.modelVersion}</dd></div></dl><Link to="/history" className="btn-secondary w-full mt-5">View saved assessment</Link></>:<><Icon name="pulse" size={25} className="text-[var(--color-text-muted)]"/><h2 className="text-lg font-medium mt-5">Your result belongs here.</h2><p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">Complete the measurements to generate an estimate from the currently active research model.</p><div className="small-definition mt-7"><span>Measurements entered</span><span>{completed} of 8</span></div><div className="small-definition"><span>Model source</span><span>Active registry model</span></div></>}</section><section className="card"><Icon name="info" size={19}/><h3 className="text-sm font-medium mt-4">Context matters.</h3><p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">This model was trained on adult women of Pima heritage and may not generalize to other populations. Results are research estimates, with no established clinical validity. Consult a qualified healthcare professional for medical decisions.</p></section></aside></div>
  </div>;
}
