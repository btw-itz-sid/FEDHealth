import { useState } from 'react';

/**
 * FedHealth Architecture Diagram
 * ==============================
 * A visual, animated, interactive representation of the federated learning
 * pipeline so that the user can explain to their guide exactly:
 *   1. Where data comes from  (hospitals)
 *   2. How it's standardised   (PCORnet / PIMA preprocessing)
 *   3. Where local training happens (client nodes)
 *   4. How aggregation works   (FedAvg server)
 *   5. Where evaluation is done (held-out test set)
 *
 * The component is self-contained (no extra dependencies beyond React).
 */

/* ---------- small sub-components ---------- */

function HospitalIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="14" width="32" height="28" rx="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2" />
      <rect x="18" y="6" width="12" height="12" rx="2" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="9" x2="24" y2="15" stroke="currentColor" strokeWidth="2" />
      <line x1="21" y1="12" x2="27" y2="12" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="22" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="28" y="22" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="14" y="32" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="28" y="32" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="20" y="34" width="8" height="8" rx="1" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

function DatabaseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="12" rx="14" ry="5" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 12v8c0 2.76 6.27 5 14 5s14-2.24 14-5v-8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.1" />
      <path d="M6 20v8c0 2.76 6.27 5 14 5s14-2.24 14-5v-8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.05" />
    </svg>
  );
}

function BrainIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="16" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="25" cy="16" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="20" cy="24" r="3" fill="currentColor" opacity="0.3" />
      <line x1="15" y1="16" x2="25" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="15" y1="16" x2="20" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="25" y1="16" x2="20" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function ServerIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="6" width="32" height="12" rx="3" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8" y="20" width="32" height="12" rx="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8" y="34" width="32" height="8" rx="3" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="12" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="14" cy="26" r="2" fill="currentColor" opacity="0.6" />
      <line x1="20" y1="12" x2="34" y2="12" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="20" y1="26" x2="34" y2="26" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </svg>
  );
}

/* ---------- layer detail panels ---------- */

const LAYER_DETAILS: Record<string, { title: string; color: string; points: string[] }> = {
  hospitals: {
    title: '1 · Healthcare Centers (Data Sources)',
    color: 'var(--color-primary-600)',
    points: [
      'Each hospital / clinic keeps its patient data locally — data never leaves the site.',
      'In this simulation, we use the PIMA Indians Diabetes Dataset as a proxy for real EHR data.',
      'The dataset is partitioned among simulated hospital nodes (IID or Non-IID splits).',
    ],
  },
  data: {
    title: '2 · Standardised Health Records',
    color: 'var(--color-teal-600)',
    points: [
      'Raw clinical data is standardised (like PCORnet CDM in real deployments).',
      'Preprocessing: zero-invalid columns replaced with NaN → median imputation → standard scaling.',
      '8 input features: pregnancies, glucose, blood pressure, skin thickness, insulin, BMI, diabetes pedigree, age.',
    ],
  },
  local: {
    title: '3 · Local Model Training',
    color: 'var(--color-indigo-600)',
    points: [
      'Each hospital node trains a logistic regression model on its own partition of the data.',
      'Training uses mini-batch SGD with configurable epochs, learning rate, and batch size.',
      'Only model weight updates are sent to the server — never raw patient data.',
      'Optional: Differential Privacy clips updates and adds Gaussian noise before sharing.',
    ],
  },
  global: {
    title: '4 · Central Aggregator (FedAvg)',
    color: '#d97706',
    points: [
      'The server receives weight updates (Δw, Δb) from all participating hospital nodes.',
      "FedAvg: weighted average of updates proportional to each node's sample count.",
      'The aggregated global model is sent back to every node for the next round.',
      'After all rounds, the final global model is evaluated on a held-out 20% test set that no node has ever seen.',
    ],
  },
  test: {
    title: '5 · Evaluation (Test Set)',
    color: 'var(--color-error)',
    points: [
      'A held-out test split (default 20%) is created before partitioning — no node ever trains on it.',
      'After each aggregation round, the global model is evaluated on this test set.',
      'Metrics tracked: accuracy, precision, recall, F1-score, ROC-AUC, log-loss, confusion matrix.',
      'This is how we know the model generalises — not just memorising local data.',
    ],
  },
};

/* ---------- animated arrow SVG ---------- */

function AnimatedArrow({ direction = 'down', color = '#94a3b8' }: { direction?: 'down' | 'up' | 'both'; color?: string }) {
  return (
    <div className="flex justify-center" style={{ height: 36 }}>
      <svg width="32" height="36" viewBox="0 0 32 36" fill="none">
        {(direction === 'down' || direction === 'both') && (
          <g>
            <line x1="12" y1="4" x2="12" y2="28" stroke={color} strokeWidth="2" strokeDasharray="4 3">
              <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.2s" repeatCount="indefinite" />
            </line>
            <polygon points="6,26 12,34 18,26" fill={color} />
          </g>
        )}
        {(direction === 'up' || direction === 'both') && (
          <g>
            <line x1="20" y1="32" x2="20" y2="8" stroke={color} strokeWidth="2" strokeDasharray="4 3">
              <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.2s" repeatCount="indefinite" />
            </line>
            <polygon points="14,10 20,2 26,10" fill={color} />
          </g>
        )}
      </svg>
    </div>
  );
}

/* ---------- main component ---------- */

export default function ArchitectureDiagram() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  const layerBase =
    'relative rounded-2xl p-5 cursor-pointer transition-all duration-300 border-2 select-none';
  const activeShadow = '0 0 0 3px rgba(59,130,246,0.25), 0 8px 24px -4px rgba(0,0,0,0.12)';

  return (
    <div className="space-y-2">
      {/* Title */}
      <div className="mb-2">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          How Federated Learning Works in FedHealth
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Click any layer to learn more · Data never leaves the hospital
        </p>
      </div>

      {/* ── Layer 1: Hospitals ── */}
      <div
        className={layerBase}
        onClick={() => setActiveLayer(activeLayer === 'hospitals' ? null : 'hospitals')}
        style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderColor: activeLayer === 'hospitals' ? 'var(--color-primary-500)' : 'var(--color-primary-200)',
          boxShadow: activeLayer === 'hospitals' ? activeShadow : 'none',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-primary-600)] text-white text-xs font-bold">1</span>
          <span className="text-sm font-semibold text-[var(--color-primary-800)]">Healthcare Centers</span>
          <span className="ml-auto text-xs text-[var(--color-primary-500)]">data sources ↓</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {['Hospital A', 'Hospital B', 'Hospital C'].map((name) => (
            <div key={name} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/60 backdrop-blur-sm">
              <HospitalIcon className="w-10 h-10 text-[var(--color-primary-600)]" />
              <span className="text-xs font-medium text-[var(--color-primary-700)]">{name}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">private patient data</span>
            </div>
          ))}
        </div>
      </div>

      <AnimatedArrow direction="down" color="var(--color-primary-400)" />

      {/* ── Layer 2: Standardised Data ── */}
      <div
        className={layerBase}
        onClick={() => setActiveLayer(activeLayer === 'data' ? null : 'data')}
        style={{
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
          borderColor: activeLayer === 'data' ? 'var(--color-teal-500)' : 'var(--color-teal-200)',
          boxShadow: activeLayer === 'data' ? activeShadow : 'none',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-teal-600)] text-white text-xs font-bold">2</span>
          <span className="text-sm font-semibold text-[var(--color-teal-800)]">Standardised Health Record Data</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {['Site A Data', 'Site B Data', 'Site C Data'].map((name) => (
            <div key={name} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/60 backdrop-blur-sm">
              <DatabaseIcon className="w-9 h-9 text-[var(--color-teal-600)]" />
              <span className="text-xs font-medium text-[var(--color-teal-700)]">{name}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">preprocessed & scaled</span>
            </div>
          ))}
        </div>
      </div>

      <AnimatedArrow direction="down" color="var(--color-teal-400)" />

      {/* ── Layer 3: Local Models ── */}
      <div
        className={layerBase}
        onClick={() => setActiveLayer(activeLayer === 'local' ? null : 'local')}
        style={{
          background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
          borderColor: activeLayer === 'local' ? 'var(--color-indigo-500)' : '#c7d2fe',
          boxShadow: activeLayer === 'local' ? activeShadow : 'none',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-indigo-600)] text-white text-xs font-bold">3</span>
          <span className="text-sm font-semibold text-indigo-800">Local Model Training</span>
          <span className="ml-auto text-xs text-indigo-400">only weight updates sent ↑</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {['Model A', 'Model B', 'Model C'].map((name) => (
            <div key={name} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/60 backdrop-blur-sm">
              <BrainIcon className="w-9 h-9 text-[var(--color-indigo-600)]" />
              <span className="text-xs font-medium text-indigo-700">{name}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">trains on local data</span>
            </div>
          ))}
        </div>
      </div>

      <AnimatedArrow direction="both" color="#8b5cf6" />

      {/* ── Layer 4: Global Model / Aggregator ── */}
      <div
        className={layerBase}
        onClick={() => setActiveLayer(activeLayer === 'global' ? null : 'global')}
        style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          borderColor: activeLayer === 'global' ? '#d97706' : '#fcd34d',
          boxShadow: activeLayer === 'global' ? activeShadow : 'none',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-bold">4</span>
          <span className="text-sm font-semibold text-amber-800">Central Aggregator — FedAvg</span>
        </div>
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-white/60 backdrop-blur-sm min-w-48">
            <ServerIcon className="w-12 h-12 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">Global Model Server</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">weighted average of all updates</span>
          </div>
        </div>
      </div>

      <AnimatedArrow direction="down" color="var(--color-error)" />

      {/* ── Layer 5: Test / Evaluation ── */}
      <div
        className={layerBase}
        onClick={() => setActiveLayer(activeLayer === 'test' ? null : 'test')}
        style={{
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          borderColor: activeLayer === 'test' ? 'var(--color-error)' : '#fca5a5',
          boxShadow: activeLayer === 'test' ? activeShadow : 'none',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-error)] text-white text-xs font-bold">5</span>
          <span className="text-sm font-semibold text-red-800">Evaluation on Held-Out Test Set</span>
        </div>
        <div className="flex justify-center">
          <div className="flex items-center gap-4 p-3 rounded-xl bg-white/60 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-2xl mb-1">📊</p>
              <span className="text-xs font-medium text-red-700">Test Set (20%)</span>
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] max-w-52 leading-relaxed">
              Never seen by any hospital node. Used after each round to measure how well the global model generalises.
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail panel ── */}
      {activeLayer && LAYER_DETAILS[activeLayer] && (
        <div
          className="rounded-xl p-5 border-2 mt-3 animate-in"
          style={{
            borderColor: LAYER_DETAILS[activeLayer].color,
            background: 'var(--color-surface)',
          }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: LAYER_DETAILS[activeLayer].color }}>
            {LAYER_DETAILS[activeLayer].title}
          </h3>
          <ul className="space-y-2">
            {LAYER_DETAILS[activeLayer].points.map((pt, i) => (
              <li key={i} className="flex gap-2 text-sm text-[var(--color-text-secondary)]">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: LAYER_DETAILS[activeLayer].color }}>
                  {i + 1}
                </span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key message */}
      <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[var(--color-primary-50)] to-[var(--color-teal-50)] border border-[var(--color-primary-200)]">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🔒</span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-primary-800)]">Key Privacy Guarantee</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Raw patient data <strong>never leaves</strong> the hospital. Only model weight updates
              (numbers, not records) are shared with the central server. With optional Differential
              Privacy, even those updates are clipped and noised before transmission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
