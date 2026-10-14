import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '@/lib/api';
import { PIMA_FEATURE_FIELDS } from '@/lib/pima';
import { modelMethodLabel, riskColor } from '@/lib/format';

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getPredictions(page, PAGE_SIZE)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    api.getPredictions(1, 100)
      .then((r) => setTrend(
        [...(r.items || [])].reverse().map((p: any) => ({
          date: new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          probability: Math.round(p.probability * 1000) / 10,
        })),
      ))
      .catch(() => {});
  }, []);

  const items = data?.items || [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Assessment History</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Only you can see your assessments.</p>
        </div>
        <Link to="/assess" className="btn-primary">+ New assessment</Link>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>}

      {trend.length > 1 && (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Risk trend</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Probability']} />
                <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" />
                <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="probability" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <p className="text-3xl mb-2">📋</p>
            <p className="mb-4">No assessments yet.</p>
            <Link to="/assess" className="btn-primary">Take your first assessment</Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                    <th className="py-3 px-2 font-medium">Date</th>
                    <th className="py-3 px-2 font-medium">Risk</th>
                    <th className="py-3 px-2 font-medium">Probability</th>
                    <th className="py-3 px-2 font-medium">Glucose</th>
                    <th className="py-3 px-2 font-medium">BMI</th>
                    <th className="py-3 px-2 font-medium">Model</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p: any) => (
                    <Fragment key={p.id}>
                      <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]">
                        <td className="py-3 px-2">{new Date(p.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-2">
                          <span className="font-semibold" style={{ color: riskColor(p.riskLevel) }}>{p.riskLevel}</span>
                        </td>
                        <td className="py-3 px-2">{(p.probability * 100).toFixed(1)}%</td>
                        <td className="py-3 px-2">{p.inputFeatures?.Glucose}</td>
                        <td className="py-3 px-2">{p.inputFeatures?.BMI}</td>
                        <td className="py-3 px-2 text-xs">{modelMethodLabel(p.trainingMethod)}</td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                            className="text-xs text-[var(--color-primary-600)] hover:underline"
                          >
                            {expanded === p.id ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {expanded === p.id && (
                        <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              {PIMA_FEATURE_FIELDS.map((f) => (
                                <div key={f.name}>
                                  <span className="text-[var(--color-text-muted)]">{f.label}:</span>{' '}
                                  <span className="font-medium">{p.inputFeatures?.[f.name]} {f.unit}</span>
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-[10px] text-[var(--color-text-muted)] font-mono">
                              Model version {p.modelVersion}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-[var(--color-text-muted)]">
                  Page {data.page} of {data.totalPages} · {data.total} assessments
                </span>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn-secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
