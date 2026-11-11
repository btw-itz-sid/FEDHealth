import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '@/lib/api';
import { methodLabel, num, pct } from '@/lib/format';

const W = 800;
const H = 430;
const SERVER = { x: 400, y: 70, w: 230, h: 70 };
const HOSPITAL_Y = 335;
const HOSPITAL_H = 92;
const LETTERS = 'ABCDEFGHIJKLMNOPQRST';

const STEPS = [
  'Patient data stays inside each hospital',
  'Each hospital trains on its own patients',
  'Only model weights travel, never patient records',
  'The server averages the models (FedAvg)',
  'The global model goes back, and the loop repeats',
  'Optional: differential privacy adds noise',
  'Result: near-pooled accuracy, zero records shared',
];

const FEATURE_LABELS: Record<string, string> = {
  Pregnancies: 'Pregnancies',
  Glucose: 'Glucose',
  BloodPressure: 'Blood pressure',
  SkinThickness: 'Skin thickness',
  Insulin: 'Insulin',
  BMI: 'BMI',
  DiabetesPedigreeFunction: 'Family history (DPF)',
  Age: 'Age',
};

interface ClientProfile {
  client_id: number;
  num_samples: number;
  class_distribution: Record<string, number>;
  train_accuracy?: number;
  update_norm?: number;
}

function latestBy(items: any[], keyOf: (e: any) => string) {
  const out = new Map<string, any>();
  for (const e of items) {
    const key = keyOf(e);
    const prev = out.get(key);
    if (!prev || e.createdAt > prev.createdAt) out.set(key, e);
  }
  return [...out.values()];
}

function newest(items: any[]) {
  return items.reduce<any>((best, e) => (!best || e.createdAt > best.createdAt ? e : best), null);
}

function diabeticShare(c: ClientProfile) {
  return c.num_samples ? (c.class_distribution['1'] ?? 0) / c.num_samples : 0;
}

function Packet({ from, to, color, delay, label }: {
  from: [number, number]; to: [number, number]; color: string; delay: number; label?: string;
}) {
  const path = `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`;
  return (
    <g>
      <rect x={-17} y={-9} width={34} height={18} rx={9} fill={color} />
      {label && <text x={0} y={4} textAnchor="middle" fontSize={10} fontWeight={700} fill="white">{label}</text>}
      <animateMotion dur="2s" repeatCount="indefinite" begin={`-${delay}s`} path={path} />
    </g>
  );
}

function Diagram({ clients, step, roundClients, round, roundAccuracy, finalAccuracy, numFeatures, shares, dp }: {
  clients: ClientProfile[];
  step: number;
  roundClients: ClientProfile[];
  round: number;
  roundAccuracy?: number;
  finalAccuracy?: number;
  numFeatures: number;
  shares: number[];
  dp: boolean;
}) {
  const n = clients.length;
  const margin = 20;
  const slot = (W - 2 * margin) / n;
  const boxW = Math.min(130, slot - 14);
  const xs = clients.map((_, i) => margin + slot * (i + 0.5));
  const top = (x: number): [number, number] => [x, HOSPITAL_Y - HOSPITAL_H / 2];
  const serverBottom = (x: number): [number, number] => [
    SERVER.x + ((x - W / 2) / (W / 2)) * (SERVER.w / 2 - 20),
    SERVER.y + SERVER.h / 2,
  ];

  const linksActive = step >= 2 && step <= 5;
  const serverLine = [
    'Has no patient data',
    'Waiting for updates',
    `Receives ${n} × ${numFeatures + 1} numbers`,
    'w = Σ (nₖ / n) · wₖ',
    `Round ${round} · test accuracy ${pct(roundAccuracy, 1)}`,
    dp ? 'Receives clipped + noisy updates' : 'Clip + noise before sending',
    `Final test accuracy ${pct(finalAccuracy, 1)}`,
  ][step];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img"
      aria-label="Federated learning diagram: hospitals send model weights to an aggregation server">
      {clients.map((c, i) => {
        const from = top(xs[i]);
        const to = serverBottom(xs[i]);
        return (
          <line key={`l${c.client_id}`} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
            stroke={linksActive ? '#93c5fd' : '#e2e8f0'} strokeWidth={linksActive ? 2.5 : 1.5}
            strokeDasharray={linksActive ? undefined : '6 6'} />
        );
      })}

      {step === 3 && clients.map((c, i) => {
        const from = top(xs[i]);
        const to = serverBottom(xs[i]);
        return (
          <g key={`s${c.client_id}`}>
            <rect x={(from[0] + to[0]) / 2 - 22} y={(from[1] + to[1]) / 2 - 11} width={44} height={22} rx={11}
              fill="white" stroke="#2563eb" />
            <text x={(from[0] + to[0]) / 2} y={(from[1] + to[1]) / 2 + 4} textAnchor="middle" fontSize={11}
              fontWeight={700} fill="#1d4ed8">{pct(shares[i], 0)}</text>
          </g>
        );
      })}

      <g key={`packets-${step}`}>
        {(step === 2 || step === 5) && clients.map((c, i) => (
          <Packet key={c.client_id} from={top(xs[i])} to={serverBottom(xs[i])}
            color={step === 5 ? '#8b5cf6' : '#2563eb'} delay={i * 0.35} label={step === 5 ? 'w+ε' : 'w'} />
        ))}
        {step === 4 && clients.map((c, i) => (
          <Packet key={c.client_id} from={serverBottom(xs[i])} to={top(xs[i])} color="#10b981" delay={i * 0.2} label="w" />
        ))}
      </g>

      {(step === 0 || step === 2) && (() => {
        const from = top(xs[0]);
        const to = serverBottom(xs[0]);
        const mx = from[0] + (to[0] - from[0]) * 0.35;
        const my = from[1] + (to[1] - from[1]) * 0.35;
        return (
          <g>
            <circle cx={mx} cy={my} r={14} fill="#fee2e2" stroke="#ef4444" strokeWidth={2} />
            <text x={mx} y={my + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#dc2626">✕</text>
            <text x={mx + 20} y={my + 4} fontSize={11} fontWeight={600} fill="#dc2626">patient rows never leave</text>
          </g>
        );
      })()}

      <g>
        <rect x={SERVER.x - SERVER.w / 2} y={SERVER.y - SERVER.h / 2} width={SERVER.w} height={SERVER.h} rx={14}
          fill={step === 3 || step === 4 ? '#eff6ff' : 'white'} stroke="#2563eb" strokeWidth={step === 3 ? 3 : 1.5} />
        <text x={SERVER.x} y={SERVER.y - 6} textAnchor="middle" fontSize={14} fontWeight={700} fill="#0f172a">
          🖥️ Aggregation server
        </text>
        <text x={SERVER.x} y={SERVER.y + 16} textAnchor="middle" fontSize={11.5} fill="#475569">{serverLine}</text>
      </g>

      {clients.map((c, i) => {
        const x = xs[i];
        const share = diabeticShare(c);
        const barW = boxW - 20;
        const rc = roundClients.find((r) => r.client_id === c.client_id);
        const training = step === 1;
        const footer =
          step === 1 ? `local acc ${pct(rc?.train_accuracy, 0)}`
          : step === 3 ? `weight ${pct(shares[i], 0)}`
          : `${pct(share, 0)} diabetic`;
        return (
          <g key={`h${c.client_id}`}>
            <rect x={x - boxW / 2} y={HOSPITAL_Y - HOSPITAL_H / 2} width={boxW} height={HOSPITAL_H} rx={12}
              fill="white" stroke={training ? '#14b8a6' : '#cbd5e1'} strokeWidth={training ? 3 : 1.5}
              className={training ? 'animate-pulse' : undefined} />
            <text x={x} y={HOSPITAL_Y - 22} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">
              🏥 Hospital {LETTERS[i]}
            </text>
            <text x={x} y={HOSPITAL_Y - 4} textAnchor="middle" fontSize={11} fill="#475569">
              🔒 {c.num_samples} patients
            </text>
            <rect x={x - barW / 2} y={HOSPITAL_Y + 6} width={barW} height={9} rx={4.5} fill="#10b981" />
            {share > 0 && (
              <rect x={x - barW / 2} y={HOSPITAL_Y + 6} width={Math.max(barW * share, 4)} height={9} rx={4.5} fill="#ef4444" />
            )}
            <text x={x} y={HOSPITAL_Y + 32} textAnchor="middle" fontSize={11} fontWeight={600}
              fill={step === 1 ? '#0f766e' : step === 3 ? '#1d4ed8' : '#64748b'}>{footer}</text>
          </g>
        );
      })}

      <g transform={`translate(${W - 230}, ${H - 18})`}>
        <rect x={0} y={-8} width={10} height={10} rx={2} fill="#ef4444" />
        <text x={14} y={1} fontSize={10.5} fill="#64748b">diabetic</text>
        <rect x={70} y={-8} width={10} height={10} rx={2} fill="#10b981" />
        <text x={84} y={1} fontSize={10.5} fill="#64748b">not diabetic</text>
        <rect x={158} y={-8} width={10} height={10} rx={2} fill="#2563eb" />
        <text x={172} y={1} fontSize={10.5} fill="#64748b">weights</text>
      </g>
    </svg>
  );
}

function MetricCard({ title, exp, highlight }: { title: string; exp: any; highlight?: boolean }) {
  const m = exp?.finalMetrics;
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]' : 'border-[var(--color-border)]'}`}>
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{title}</p>
      {exp ? (
        <>
          <p className="text-xl font-bold mt-1">{pct(m?.accuracy)}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">F1 {num(m?.f1_score, 3)} · recall {num(m?.recall, 3)}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{methodLabel(exp)}</p>
        </>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)] mt-1">No matching run yet</p>
      )}
    </div>
  );
}

export default function HowItWorksPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [experiment, setExperiment] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [roundIdx, setRoundIdx] = useState(0);

  useEffect(() => {
    api.getExperiments(1, 100)
      .then((r) => setItems((r.items || []).filter((e: any) => e.status === 'completed')))
      .catch(() => setItems([]))
      .finally(() => setLoadingList(false));
  }, []);

  const fedavgOptions = useMemo(
    () => latestBy(items.filter((e) => e.trainingMethod === 'fedavg'), (e) => e.name)
      .sort((a, b) => Number(a.differentialPrivacy) - Number(b.differentialPrivacy) || a.name.localeCompare(b.name)),
    [items],
  );

  useEffect(() => {
    if (selectedId || fedavgOptions.length === 0) return;
    const plain = fedavgOptions.filter((e) => !e.differentialPrivacy);
    const preferred =
      newest(plain.filter((e) => e.partitionType === 'non_iid' && e.balanceClasses))
      ?? newest(plain.filter((e) => e.partitionType === 'non_iid'))
      ?? newest(plain)
      ?? fedavgOptions[0];
    setSelectedId(preferred.id);
  }, [fedavgOptions, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    Promise.all([
      api.getExperiment(selectedId),
      api.getExperimentRounds(selectedId).catch(() => ({ rounds: [] })),
    ]).then(([exp, rnd]) => {
      setExperiment(exp);
      setRounds(rnd?.rounds || []);
      setRoundIdx(0);
    }).catch(() => setExperiment(null));
  }, [selectedId]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back]);

  useEffect(() => {
    if (!playing) return;
    if (step >= STEPS.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(next, 7000);
    return () => clearTimeout(timer);
  }, [playing, step, next]);

  useEffect(() => {
    if (step !== 4 || rounds.length === 0) return;
    setRoundIdx(0);
    const timer = setInterval(() => setRoundIdx((r) => (r + 1) % rounds.length), 650);
    return () => clearInterval(timer);
  }, [step, rounds.length]);

  const comparisons = useMemo(() => {
    if (!experiment) return { centralized: null, localOnly: null, dpRuns: [] as any[], noDp: null };
    const balanced = !!experiment.balanceClasses;
    const same = (e: any) => !!e.balanceClasses === balanced;
    const dpRuns = latestBy(
      items.filter((e) => e.trainingMethod === 'fedavg' && e.differentialPrivacy && same(e)),
      (e) => `${e.partitionType}-${e.dpConfig?.epsilon}`,
    ).sort((a, b) => (a.dpConfig?.epsilon ?? 0) - (b.dpConfig?.epsilon ?? 0));
    const dpPartition = dpRuns[0]?.partitionType;
    return {
      centralized: newest(items.filter((e) => e.trainingMethod === 'centralized' && same(e))),
      localOnly: newest(items.filter((e) => e.trainingMethod === 'local_only' && e.partitionType === experiment.partitionType && same(e))),
      dpRuns,
      noDp: newest(items.filter((e) => e.trainingMethod === 'fedavg' && !e.differentialPrivacy
        && e.partitionType === dpPartition && same(e))),
    };
  }, [experiment, items]);

  if (loadingList) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div></div>;
  }

  if (fedavgOptions.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-3xl mb-2">🔄</p>
        <p className="font-medium">No completed FedAvg experiment yet</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Run the benchmark suite on the <Link to="/experiments" className="underline text-[var(--color-primary-600)]">Experiments</Link> page, then come back.
        </p>
      </div>
    );
  }

  const m = experiment?.finalMetrics;
  const clients: ClientProfile[] = m?.clients || [];
  const firstRoundClients: ClientProfile[] = rounds[0]?.clientMetrics || [];
  const totalTrain = clients.reduce((s, c) => s + c.num_samples, 0);
  const shares = clients.map((c) => (totalTrain ? c.num_samples / totalTrain : 0));
  const numFeatures = experiment?.finalMetrics?.global_model
    ? Object.keys(experiment.finalMetrics.global_model.weights).length
    : 8;
  const bytesPerTransfer = m?.global_model?.bytes_per_transfer ?? (numFeatures + 1) * 8;
  const roundSeries = rounds.map((r) => ({ round: r.roundNumber, accuracy: r.evalMetrics?.accuracy, f1: r.evalMetrics?.f1_score }));
  const current = rounds[Math.min(roundIdx, Math.max(rounds.length - 1, 0))];
  const roundAccuracies = roundSeries.map((r) => r.accuracy ?? 0);
  const converged = roundAccuracies.length > 1
    && Math.max(...roundAccuracies) - Math.min(...roundAccuracies) < 0.03;
  const sortedByDiabetic = [...clients].sort((a, b) => diabeticShare(b) - diabeticShare(a));
  const mostDiabetic = sortedByDiabetic[0];
  const leastDiabetic = sortedByDiabetic[sortedByDiabetic.length - 1];
  const letter = (c?: ClientProfile) => (c ? LETTERS[clients.indexOf(c)] : '');
  const weights = m?.global_model
    ? Object.entries(m.global_model.weights as Record<string, number>).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    : [];
  const maxAbsWeight = Math.max(...weights.map(([, v]) => Math.abs(v)), 1e-9);
  const largestHospital = clients.reduce<ClientProfile | null>((best, c) => (!best || c.num_samples > best.num_samples ? c : best), null);
  const fedAcc = m?.accuracy;
  const centralAcc = comparisons.centralized?.finalMetrics?.accuracy;

  const panels: React.ReactNode[] = [
    <div key="data" className="space-y-3">
      <p>We split the PIMA dataset (768 patients) into <b>{clients.length} simulated hospitals</b>. Each hospital keeps its own patient records. 154 patients are held back as a test set that no hospital ever sees.</p>
      {experiment?.partitionType === 'non_iid' && mostDiabetic && leastDiabetic && (
        <p>This run is <b>non-IID</b>, like real hospitals: Hospital {letter(mostDiabetic)} is {pct(diabeticShare(mostDiabetic), 0)} diabetic, while Hospital {letter(leastDiabetic)} is only {pct(diabeticShare(leastDiabetic), 0)}.</p>
      )}
      <p className="text-[var(--color-text-secondary)]">The server starts with nothing: no rows, no model.</p>
    </div>,

    <div key="train" className="space-y-3">
      <p>Every hospital receives the same starting model and trains it on its own patients for <b>{experiment?.localEpochs} epochs</b> of mini-batch gradient descent. The data never leaves the building.</p>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-[var(--color-text-muted)]"><th className="py-1">Hospital</th><th>Patients</th><th>Round-1 local accuracy</th></tr></thead>
        <tbody>
          {clients.map((c, i) => (
            <tr key={c.client_id} className="border-t border-[var(--color-border)]">
              <td className="py-1">{LETTERS[i]}</td>
              <td>{c.num_samples}</td>
              <td>{pct(firstRoundClients.find((r) => r.client_id === c.client_id)?.train_accuracy, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--color-text-muted)]">High local accuracy on a skewed hospital is misleading: a hospital with almost no diabetic patients learns to say "not diabetic".</p>
    </div>,

    <div key="upload" className="space-y-3">
      <p>A logistic regression model is just <b>{numFeatures} weights + 1 bias = {numFeatures + 1} numbers</b> ({bytesPerTransfer} bytes). That is all each hospital sends.</p>
      {largestHospital && (
        <p>Hospital {letter(largestHospital)} holds {largestHospital.num_samples} patients × 9 columns = <b>{(largestHospital.num_samples * 9).toLocaleString()} values</b>. It sends {numFeatures + 1}.</p>
      )}
      {weights.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Final global weights from this run (standardised features)</p>
          <div className="space-y-1">
            {weights.map(([feature, value]) => (
              <div key={feature} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-[var(--color-text-secondary)]">{FEATURE_LABELS[feature] ?? feature}</span>
                <div className="flex-1 h-2 rounded bg-[var(--color-surface-tertiary)] overflow-hidden">
                  <div className="h-2 rounded" style={{ width: `${(Math.abs(value) / maxAbsWeight) * 100}%`, background: value >= 0 ? '#ef4444' : '#10b981' }} />
                </div>
                <span className="w-14 text-right font-mono">{value >= 0 ? '+' : ''}{value.toFixed(3)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 text-[var(--color-text-secondary)]">Bias</span>
              <div className="flex-1" />
              <span className="w-14 text-right font-mono">{m.global_model.bias.toFixed(3)}</span>
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">Red raises diabetes risk, green lowers it. No individual patient row can be read back out of these 9 numbers.</p>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">Re-run this experiment to see its weights here. Older runs did not store them.</p>
      )}
    </div>,

    <div key="average" className="space-y-3">
      <p>The server combines the {clients.length} models with <b>Federated Averaging</b>. Each hospital counts in proportion to how many patients it has:</p>
      <p className="font-mono text-sm text-center py-2 rounded bg-[var(--color-surface-secondary)]">w<sub>global</sub> = Σ (n<sub>k</sub> / n) · w<sub>k</sub></p>
      <div className="space-y-1">
        {clients.map((c, i) => (
          <div key={c.client_id} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0">Hospital {LETTERS[i]}</span>
            <div className="flex-1 h-2 rounded bg-[var(--color-surface-tertiary)] overflow-hidden">
              <div className="h-2 rounded bg-[var(--color-primary-500)]" style={{ width: `${shares[i] * 100}%` }} />
            </div>
            <span className="w-24 text-right">{c.num_samples} / {totalTrain} = {pct(shares[i], 0)}</span>
          </div>
        ))}
      </div>
      <p className="text-[var(--color-text-secondary)]">The server only ever sees weights, never which patient is diabetic.</p>
    </div>,

    <div key="repeat" className="space-y-3">
      <p>The new global model goes back to every hospital, and the next round starts from it. This run did <b>{rounds.length} rounds</b>.</p>
      <p>Round <b>{current?.roundNumber ?? '—'}</b>: accuracy on the 154 held-out patients is <b>{pct(current?.evalMetrics?.accuracy, 1)}</b>.</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={roundSeries} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="round" fontSize={11} />
            <YAxis domain={[0.4, 0.9]} ticks={[0.4, 0.5, 0.6, 0.7, 0.8, 0.9]} fontSize={11} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <Tooltip formatter={(v) => (typeof v === 'number' ? pct(v, 1) : String(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#2563eb" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="f1" name="F1" stroke="#14b8a6" dot={false} strokeWidth={2} isAnimationActive={false} />
            {current && <ReferenceDot x={current.roundNumber} y={current.evalMetrics?.accuracy} r={5} fill="#2563eb" stroke="white" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {converged && (
        <p className="text-xs text-[var(--color-text-secondary)]">With only 9 parameters the model settles within the first round. Later rounds fine-tune it by a point or two.</p>
      )}
      <p className="text-xs text-[var(--color-text-muted)]">Total traffic for the whole run: {((m?.total_communication_bytes ?? 0) / 1024).toFixed(1)} KB of weights.</p>
    </div>,

    <div key="privacy" className="space-y-3">
      <p>Weights could still leak a little about the training data. With <b>differential privacy</b>, each hospital clips its update and adds Gaussian noise before sending it. Smaller ε means more noise and stronger privacy.</p>
      {comparisons.dpRuns.length > 0 ? (
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[var(--color-text-muted)]"><th className="py-1">ε per round</th><th>Total ε</th><th>Accuracy</th><th>ROC-AUC</th></tr></thead>
          <tbody>
            {comparisons.noDp && (
              <tr className="border-t border-[var(--color-border)]">
                <td className="py-1">No DP</td><td>—</td>
                <td>{pct(comparisons.noDp.finalMetrics?.accuracy, 1)}</td>
                <td>{num(comparisons.noDp.finalMetrics?.roc_auc, 3)}</td>
              </tr>
            )}
            {comparisons.dpRuns.map((e) => (
              <tr key={e.id} className="border-t border-[var(--color-border)]">
                <td className="py-1">{e.dpConfig?.epsilon}</td>
                <td>{e.finalMetrics?.privacy?.cumulative_epsilon ?? '—'}</td>
                <td>{pct(e.finalMetrics?.accuracy, 1)}</td>
                <td>{num(e.finalMetrics?.roc_auc, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">Run the benchmark suite to see FedAvg + DP results here.</p>
      )}
      <p className="text-xs text-[var(--color-text-muted)]">Privacy costs accuracy: this is the trade-off the project measures. DP runs use the {comparisons.dpRuns[0]?.partitionType === 'non_iid' ? 'non-IID' : 'IID'} split.</p>
    </div>,

    <div key="result" className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <MetricCard title="Centralized (all data pooled)" exp={comparisons.centralized} />
        <MetricCard title="FedAvg (this run)" exp={experiment} highlight />
        <MetricCard title="Each hospital alone" exp={comparisons.localOnly} />
      </div>
      {fedAcc != null && centralAcc != null && (
        <p>FedAvg reaches <b>{pct(fedAcc / centralAcc, 0)}</b> of the pooled model's accuracy, and <b>0 patient records</b> left any hospital.</p>
      )}
      {comparisons.localOnly && (
        <p className="text-[var(--color-text-secondary)]">Hospitals training alone score {pct(comparisons.localOnly.finalMetrics?.accuracy, 1)} on average. Collaboration helps most when hospitals see different patients.</p>
      )}
    </div>,
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">How it works</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Federated learning, step by step, using a real training run</p>
        </div>
        <div className="min-w-64">
          <label className="label">Experiment</label>
          <select className="input" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setStep(0); }}>
            {fedavgOptions.map((e) => (
              <option key={e.id} value={e.id}>{e.name} — {pct(e.finalMetrics?.accuracy, 1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4" role="tablist" aria-label="Steps">
        {STEPS.map((title, i) => (
          <button key={title} role="tab" aria-selected={step === i} onClick={() => { setStep(i); setPlaying(false); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              step === i ? 'bg-[var(--color-primary-600)] text-white'
              : i < step ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
              : 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]'}`}>
            {i + 1}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="card xl:col-span-3">
          {experiment && clients.length > 0 ? (
            <Diagram clients={clients} step={step} roundClients={firstRoundClients}
              round={current?.roundNumber ?? 1} roundAccuracy={current?.evalMetrics?.accuracy}
              finalAccuracy={m?.accuracy} numFeatures={numFeatures} shares={shares}
              dp={!!experiment.differentialPrivacy} />
          ) : (
            <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div></div>
          )}
        </div>

        <div className="card xl:col-span-2 flex flex-col">
          <p className="text-xs font-semibold text-[var(--color-primary-600)] uppercase tracking-wider">Step {step + 1} of {STEPS.length}</p>
          <h2 className="text-lg font-bold mt-1 mb-3">{STEPS[step]}</h2>
          <div className="text-sm leading-relaxed flex-1">{experiment ? panels[step] : null}</div>
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[var(--color-border)]">
            <button className="btn-secondary" onClick={() => { back(); setPlaying(false); }} disabled={step === 0}>← Back</button>
            <button className="btn-secondary" onClick={() => setPlaying((p) => !p)}
              disabled={step === STEPS.length - 1 && !playing}>{playing ? '❚❚ Pause' : '▶ Auto-play'}</button>
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" onClick={() => { next(); setPlaying(false); }}>Next →</button>
            ) : (
              <button className="btn-primary" onClick={() => setStep(0)}>Start over</button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-[var(--color-text-muted)]">
        Hospitals are simulated partitions of one public dataset (PIMA, 768 records). All numbers are research estimates, not clinically valid. Use ← → keys to move between steps.
      </p>
    </div>
  );
}
