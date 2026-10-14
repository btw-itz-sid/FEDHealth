import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { PIMA_FEATURE_FIELDS, SAMPLE_PATIENTS } from '@/lib/pima';
import { modelMethodLabel, riskColor } from '@/lib/format';

type Values = Record<string, string>;

function validate(values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of PIMA_FEATURE_FIELDS) {
    const raw = values[field.name];
    if (raw === undefined || raw.trim() === '') {
      errors[field.name] = 'Required';
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      errors[field.name] = 'Must be a number';
    } else if (value < field.min || value > field.max) {
      errors[field.name] = `Must be between ${field.min} and ${field.max}`;
    }
  }
  return errors;
}

export default function AssessPage() {
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fillSample = (sample: Record<string, number>) => {
    setValues(Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, String(v)])));
    setErrors({});
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const input = Object.fromEntries(
        PIMA_FEATURE_FIELDS.map((f) => [f.name, Number(values[f.name])]),
      );
      setResult(await api.createPrediction(input));
    } catch (err: any) {
      setSubmitError(err.message || 'Prediction failed');
    } finally {
      setSubmitting(false);
    }
  };

  const probability = result?.probability ?? 0;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Diabetes Risk Assessment</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Enter your health measurements to get a research estimate of diabetes risk.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={handleSubmit} className="card lg:col-span-3" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold">Health measurements</h2>
            <div className="flex gap-2">
              {Object.entries(SAMPLE_PATIENTS).map(([label, sample]) => (
                <button key={label} type="button" onClick={() => fillSample(sample)} className="btn-secondary text-xs py-1 px-2">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PIMA_FEATURE_FIELDS.map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="label">
                  {field.label}
                  {field.unit && <span className="text-[var(--color-text-muted)] font-normal"> ({field.unit})</span>}
                </label>
                <input
                  id={field.name}
                  type="number"
                  inputMode="decimal"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  className={`input ${errors[field.name] ? 'input-error' : ''}`}
                  placeholder={`${field.min} – ${field.max}`}
                />
                {errors[field.name] ? (
                  <p className="mt-1 text-xs text-[var(--color-error)]">{errors[field.name]}</p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {field.description}
                    {field.zeroMeansUnknown && ' · enter 0 if unknown'}
                  </p>
                )}
              </div>
            ))}
          </div>

          {submitError && <div className="mt-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{submitError}</div>}

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={submitting} className="btn-primary px-6">
              {submitting ? 'Analyzing…' : 'Get risk assessment'}
            </button>
            <button type="button" onClick={() => { setValues({}); setErrors({}); setResult(null); }} className="btn-secondary">
              Clear
            </button>
          </div>
        </form>

        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <div className="card">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Result</p>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold" style={{ color: riskColor(result.riskLevel) }}>
                  {result.riskLevel} risk
                </span>
              </div>

              <div className="mb-1 flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>Estimated probability</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{(probability * 100).toFixed(1)}%</span>
              </div>
              <div className="relative h-3 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500">
                <div
                  className="absolute -top-1 h-5 w-1.5 rounded bg-[var(--color-text-primary)] shadow"
                  style={{ left: `calc(${probability * 100}% - 3px)` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--color-text-muted)]">
                <span>Low &lt; 30%</span><span>Moderate 30–60%</span><span>High ≥ 60%</span>
              </div>

              <dl className="mt-5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Model</dt>
                  <dd className="font-medium">{modelMethodLabel(result.trainingMethod)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Version</dt>
                  <dd className="font-mono">{result.modelVersion}</dd>
                </div>
              </dl>

              <Link to="/history" className="mt-4 inline-block text-sm text-[var(--color-primary-600)] hover:underline">
                View my history →
              </Link>
            </div>
          ) : (
            <div className="card text-center py-10 text-[var(--color-text-muted)]">
              <p className="text-3xl mb-2">🩺</p>
              <p className="text-sm">Your result will appear here.</p>
            </div>
          )}

          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <strong>Research estimate only.</strong> This is not a medical diagnosis. The model was trained on
            the PIMA Indians Diabetes dataset (adult women of Pima heritage) and may not generalise to you.
            Please consult a qualified healthcare professional.
          </div>
        </div>
      </div>
    </div>
  );
}
