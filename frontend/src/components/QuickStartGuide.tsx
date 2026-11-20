import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * QuickStartGuide — Step-by-step interactive walkthrough
 * ======================================================
 * Helps the user (and their guide) understand the demo flow:
 *   Step 1: Upload dataset
 *   Step 2: Run federated experiment
 *   Step 3: Compare methods
 *   Step 4: Make a prediction
 *
 * Each step has a description, a "Go" link, and can be checked off.
 */

const STEPS = [
  {
    number: 1,
    title: 'Upload Dataset',
    description: 'Upload the PIMA Indians Diabetes CSV (768 records, 8 health features). This is our source data — simulating health records from hospitals.',
    icon: '📁',
    link: '/datasets',
    linkLabel: 'Go to Datasets →',
    color: 'var(--color-primary-600)',
    bgColor: 'var(--color-primary-50)',
  },
  {
    number: 2,
    title: 'Run Federated Experiment',
    description: 'Run a FedAvg experiment: the dataset gets split among simulated hospital nodes, each trains locally, and the server aggregates their updates. Try "Run benchmark suite" to run all methods at once.',
    icon: '🔬',
    link: '/experiments',
    linkLabel: 'Go to Experiments →',
    color: 'var(--color-teal-600)',
    bgColor: 'var(--color-teal-50)',
  },
  {
    number: 3,
    title: 'Compare Results',
    description: 'Compare Centralized vs FedAvg vs Local-Only side by side. See how accuracy, F1, and ROC-AUC change with IID/Non-IID data and different privacy budgets (ε).',
    icon: '📈',
    link: '/compare',
    linkLabel: 'Go to Compare →',
    color: 'var(--color-indigo-600)',
    bgColor: 'var(--color-indigo-50)',
  },
  {
    number: 4,
    title: 'Make a Prediction',
    description: 'Enter 8 health measurements or choose an illustrative sample. The assessment uses the model currently active in the registry; check its training method and version. Results are research estimates.',
    icon: '🩺',
    link: '/assess',
    linkLabel: 'Try Risk Assessment →',
    color: '#d97706',
    bgColor: '#fffbeb',
  },
];

export default function QuickStartGuide() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(true);

  const toggle = (step: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            Demo Walkthrough
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            {completed.size}/{STEPS.length} steps
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {/* Progress bar */}
          <div className="relative h-2 rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${(completed.size / STEPS.length) * 100}%`,
                background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-teal-500))',
              }}
            />
          </div>

          {STEPS.map((step) => {
            const done = completed.has(step.number);
            return (
              <div
                key={step.number}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 ${
                  done
                    ? 'bg-[var(--color-surface-secondary)] border-[var(--color-border)] opacity-60'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:shadow-sm'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggle(step.number)}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 ${
                    done
                      ? 'bg-[var(--color-success)] border-[var(--color-success)]'
                      : 'border-[var(--color-border-strong)] hover:border-[var(--color-primary-400)]'
                  }`}
                >
                  {done && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm">{step.icon}</span>
                    <span className={`text-sm font-semibold ${done ? 'line-through' : ''}`} style={{ color: done ? 'var(--color-text-muted)' : step.color }}>
                      Step {step.number}: {step.title}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-2">
                    {step.description}
                  </p>
                  <Link
                    to={step.link}
                    className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    style={{ color: step.color }}
                  >
                    {step.linkLabel}
                  </Link>
                </div>
              </div>
            );
          })}

          {completed.size === STEPS.length && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
              <p className="text-sm font-semibold text-green-800">🎉 Demo complete!</p>
              <p className="text-xs text-green-600 mt-1">
                You've walked through the full federated learning pipeline.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
