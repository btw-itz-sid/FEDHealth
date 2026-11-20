import { useState } from 'react';
import { downloadFile } from '@/lib/format';

interface ClientUpdate {
  client_id: number;
  num_samples: number;
  aggregation_weight: number;
  delta: number[];
}

export interface FederationTrace {
  schema_version: number;
  round_number: number;
  parameter_order: string[];
  global_before: number[];
  client_updates: ClientUpdate[];
  weighted_delta: number[];
  global_after: number[];
  total_train_samples: number;
  updates_privatized: boolean;
  parameter_bytes_per_vector: number;
}

export interface TraceRound {
  roundNumber: number;
  evalMetrics?: { federation_trace?: FederationTrace };
}

const PARAMETERS = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'bias'];

function illustration(): TraceRound[] {
  const clients = [.2, .5, .8].map((value, i) => ({
    client_id: i, num_samples: (i + 1) * 100, aggregation_weight: (i + 1) / 6,
    delta: PARAMETERS.map((_, index) => index === 1 ? value : index === 8 ? -.1 * (i + 1) : 0),
  }));
  const average = PARAMETERS.map((_, index) => clients.reduce((sum, c) => sum + c.aggregation_weight * c.delta[index], 0));
  return [{ roundNumber: 1, evalMetrics: { federation_trace: {
    schema_version: 1, round_number: 1, parameter_order: PARAMETERS, global_before: new Array<number>(9).fill(0),
    client_updates: clients, weighted_delta: average, global_after: average,
    total_train_samples: 600, updates_privatized: false, parameter_bytes_per_vector: 72,
  } } }];
}

const format = (value: number) => value.toFixed(6);

export default function FederationRoundInspector({ rounds, illustrative = false }: { rounds: TraceRound[]; illustrative?: boolean }) {
  const [selectedRound, setSelectedRound] = useState(1);
  const [parameter, setParameter] = useState('Glucose');
  const available = illustrative ? illustration() : rounds.filter((r) => r.evalMetrics?.federation_trace);
  const current = available.find((r) => r.roundNumber === selectedRound) ?? available[0];
  const trace = current?.evalMetrics?.federation_trace;

  if (!trace) {
    return <div className="card mb-6 text-sm text-[var(--color-text-secondary)]">This older run has no numerical round trace. Run a new FedAvg experiment to inspect actual client updates.</div>;
  }

  const index = Math.max(0, trace.parameter_order.indexOf(parameter));
  const reconstructed = trace.parameter_order.map((_, i) => trace.global_before[i] + trace.client_updates.reduce(
    (sum, client) => sum + client.num_samples / trace.total_train_samples * client.delta[i], 0,
  ));
  const maxError = Math.max(...reconstructed.map((value, i) => Math.abs(value - trace.global_after[i])));
  const verified = maxError < 1e-10;

  return (
    <section className="card mb-6 space-y-5" aria-label="FedAvg numerical round inspector">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-600)]">Follow the numbers</p>
          <h2 className="text-xl font-bold mt-1">What exactly reaches FedAvg?</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{illustrative ? 'Illustrative calculation — these numbers are not measured experiment results.' : 'Actual parameter updates recorded by this training run. No patient rows in this trace.'}</p>
        </div>
        <span className={`badge ${illustrative ? 'badge-neutral' : 'badge-success'}`}>{illustrative ? 'Illustrative example' : 'Recorded training trace'}</span>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">Round
          <select className="input mt-1" value={current.roundNumber} onChange={(e) => setSelectedRound(Number(e.target.value))}>
            {available.map((r) => <option key={r.roundNumber} value={r.roundNumber}>Round {r.roundNumber}</option>)}
          </select>
        </label>
        <label className="text-sm">Parameter to inspect
          <select className="input mt-1" value={trace.parameter_order[index]} onChange={(e) => setParameter(e.target.value)}>
            {trace.parameter_order.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <button className="btn-secondary" onClick={() => downloadFile(`fedavg-round-${current.roundNumber}${illustrative ? '-illustrative' : ''}.json`, JSON.stringify(trace, null, 2), 'application/json')}>Export round trace</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="federation-stat">
          <p className="text-xs font-semibold">① Shared starting {trace.parameter_order[index]}</p>
          <p className="text-2xl font-mono font-bold mt-2">{format(trace.global_before[index])}</p>
          <p className="text-xs mt-2">{current.roundNumber === 1 ? `All ${trace.parameter_order.length-1} weights and bias start at zero. Initial probability = sigmoid(0) = 0.5.` : 'Copied from the previous round’s global model by every hospital.'}</p>
        </div>
        <div className="federation-stat">
          <p className="text-xs font-semibold">② Sample-weighted change</p>
          <p className="text-2xl font-mono font-bold mt-2">{format(reconstructed[index] - trace.global_before[index])}</p>
          <p className="text-xs mt-2">Σ (hospital training count / {trace.total_train_samples}) × sent delta</p>
        </div>
        <div className="federation-stat">
          <p className="text-xs font-semibold">③ New global {trace.parameter_order[index]}</p>
          <p className="text-2xl font-mono font-bold mt-2">{format(trace.global_after[index])}</p>
          <p className="text-xs mt-2">Previous parameter + weighted change. Broadcast for the next round.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-left text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <tr>{['Hospital', 'Training records', 'Share nₖ/N', ...(trace.updates_privatized ? [] : ['Locally learned value']), trace.updates_privatized ? 'Clipped + noisy delta sent' : 'Delta sent', 'Weighted contribution'].map((title) => <th key={title} className="p-2 font-medium">{title}</th>)}</tr>
          </thead>
          <tbody>
            {trace.client_updates.map((client) => (
              <tr key={client.client_id} className="border-b border-[var(--color-border)]">
                <td className="p-2 font-medium">Hospital {client.client_id + 1}</td>
                <td className="p-2">{client.num_samples}</td>
                <td className="p-2 font-mono">{client.num_samples}/{trace.total_train_samples}</td>
                {!trace.updates_privatized && <td className="p-2 font-mono">{format(trace.global_before[index] + client.delta[index])}</td>}
                <td className="p-2 font-mono">{format(client.delta[index])}</td>
                <td className="p-2 font-mono">{format(client.num_samples / trace.total_train_samples * client.delta[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`rounded-lg p-3 text-sm ${verified ? 'border border-[var(--color-border)] text-[var(--color-primary-700)]' : 'border border-[var(--color-error)] text-[var(--color-error)]'}`} role="status">
        <b>{verified ? 'All 9 parameters verified' : 'Trace mismatch detected'}.</b> Recalculated in your browser using sample counts and deltas. Maximum absolute error: {maxError.toExponential(2)}.
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Inspect one hospital’s complete aggregation payload</summary>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 text-slate-100 p-4 text-xs mt-3">{JSON.stringify({
          round_number: current.roundNumber, client_id: trace.client_updates[0].client_id,
          num_samples: trace.client_updates[0].num_samples, delta: trace.client_updates[0].delta,
        }, null, 2)}</pre>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">Delta order: {trace.parameter_order.join(', ')}. {trace.parameter_bytes_per_vector} bytes describes the float64 parameter vector; JSON, counts, diagnostics and network overhead are additional.</p>
      </details>
      <p className="text-xs text-[var(--color-text-muted)]">Patient records are excluded from the aggregator input. This public-data simulator uses one process and pooled training preprocessing. Shared updates may still leak information. {trace.updates_privatized && 'Only the clipped, noisy updates are shown here; seeded noise is an educational mechanism, not a certified privacy guarantee.'}</p>
    </section>
  );
}
