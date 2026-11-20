import { useState } from 'react';
import { Link } from 'react-router-dom';

const PHASES = [
  { title: 'Initialize once', short: 'Initialize', text: 'The coordinator creates one untrained logistic regression model: 8 weights = 0, bias = 0. It predicts 0.5 before learning. No patient records are needed to create these numbers.', server: 'θ₀ = [0, 0, 0, 0, 0, 0, 0, 0, 0]', down: '① Broadcast the same starting parameters', up: 'Waiting for local training' },
  { title: 'Train inside each hospital', short: 'Train locally', text: 'Each hospital copies the same global model, then uses only its own feature rows and outcome labels for mini-batch SGD. Training changes the coefficients; a model does not collect or contain a copy of the dataset.', server: 'Keep θₜ while clients train', down: 'Same θₜ → every hospital', up: 'Data + labels stay inside the local trainer' },
  { title: 'Send changes, not records', short: 'Send updates', text: 'Hospital k sends Δθₖ = θₖ − θₜ and its training sample count nₖ. The update contains 8 coefficient changes and 1 bias change. Optional clipping and noise happen before aggregation.', server: 'Input: {client_id, num_samples, delta[9]}', down: 'No patient rows in the update contract', up: '③ Upload Δθₖ + nₖ' },
  { title: 'Compute a sample-weighted average', short: 'Aggregate', text: 'The server adds the weighted average of the deltas to the previous model. A hospital with 200 training records contributes twice as much as one with 100. The server needs parameter vectors and counts for this calculation.', server: 'θₜ₊₁ = θₜ + Σ (nₖ / N) Δθₖ', down: '④ Broadcast the improved global parameters', up: 'N = total participating training records' },
  { title: 'Repeat, evaluate, then serve', short: 'Evaluate', text: 'Every next round starts from the previous global model. Rounds are monitored on validation data; the final model is evaluated on a separate test set. A researcher can activate the registered model for research risk estimates.', server: 'Validation → final test → model registry', down: 'Next round starts from θₜ₊₁', up: 'No training on validation or test records' },
];

export default function ArchitectureDiagram({ walkthroughHref }: { walkthroughHref?: string }) {
  const [phase, setPhase] = useState(0);
  const selected = PHASES[phase];
  return (
    <section className="space-y-4" aria-label="Federated learning architecture">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">One model · many local datasets</p>
          <h2 className="text-lg font-bold mt-1">Follow one federated training round</h2>
        </div>
        {walkthroughHref && <Link to={walkthroughHref} className="btn-secondary text-xs">Open the round inspector</Link>}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Architecture phases">
        {PHASES.map((item, i) => (
          <button key={item.title} onClick={() => setPhase(i)} aria-pressed={phase === i}
            className={`rounded-lg px-3 py-2 text-xs font-medium border ${phase === i ? 'bg-[var(--color-text-primary)] text-white border-[var(--color-text-primary)]' : 'border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]'}`}>
            {i + 1}. {item.short}
          </button>
        ))}
      </div>
      <div className="architecture-server">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Coordinator / FedAvg aggregator</p>
        <p className="font-mono text-xs sm:text-sm text-[var(--color-text-primary)] mt-2 break-words">{selected.server}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center text-xs">
        <div className="p-2 text-[var(--color-text-secondary)]">↓ {selected.down}</div>
        <div className="p-2 text-[var(--color-text-secondary)]">↑ {selected.up}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {['A', 'B', 'C'].map((site) => (
          <div key={site} className={`architecture-site space-y-3 ${phase === 1 ? 'outline outline-1 outline-[var(--color-primary-400)]' : ''}`}>
            <p className="text-sm font-semibold text-slate-800">Hospital {site}</p>
            <div className="rounded-lg bg-white border border-slate-200 p-2 text-xs text-slate-600">Local data<br /><b className="text-slate-800">Features X + labels y</b></div>
            <p className="text-center text-xs text-slate-500">↓ used only by this trainer</p>
            <div className="rounded-lg bg-white border border-slate-200 p-2 text-xs text-slate-600">Local SGD<br /><b className="text-slate-800">Copy θₜ → learn θₖ</b></div>
            <p className="font-mono text-xs text-[var(--color-text-secondary)]">↑ Δθₖ = θₖ − θₜ</p>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--color-border)] pt-5" aria-live="polite">
        <h3 className="font-semibold text-sm">{phase + 1}. {selected.title}</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed">{selected.text}</p>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        <b>Implementation boundary:</b> these are simulated hospitals in one Python process using a public CSV.
        Training-only preprocessing statistics are pooled and shared. The aggregator function receives updates and counts;
        the overall simulator can access the dataset. Model updates can leak information; this is not a deployment privacy guarantee.
      </p>
    </section>
  );
}
