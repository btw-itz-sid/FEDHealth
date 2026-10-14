export function pct(value: number | null | undefined, digits = 1): string {
  return value != null ? `${(value * 100).toFixed(digits)}%` : '—';
}

export function num(value: number | null | undefined, digits = 4): string {
  return value != null ? value.toFixed(digits) : '—';
}

export function methodLabel(exp: {
  trainingMethod?: string;
  partitionType?: string;
  differentialPrivacy?: boolean;
  dpConfig?: { epsilon?: number } | null;
}): string {
  const method =
    exp.trainingMethod === 'fedavg' ? 'FedAvg'
    : exp.trainingMethod === 'local_only' ? 'Local only'
    : exp.trainingMethod === 'centralized' ? 'Centralized'
    : exp.trainingMethod || '—';
  const parts = [method];
  if (exp.partitionType && exp.partitionType !== 'none') {
    parts.push(exp.partitionType === 'non_iid' ? 'Non-IID' : 'IID');
  }
  if (exp.differentialPrivacy) {
    parts.push(`DP ε=${exp.dpConfig?.epsilon ?? '?'}`);
  }
  return parts.join(' · ');
}

export function modelMethodLabel(method?: string): string {
  switch (method) {
    case 'fedavg': return 'FedAvg';
    case 'fedavg_dp': return 'FedAvg + DP';
    case 'local_only': return 'Local only';
    case 'centralized': return 'Centralized';
    default: return method || '—';
  }
}

export function statusBadge(status?: string): string {
  switch (status) {
    case 'completed':
    case 'valid':
    case 'ready':
      return 'badge-success';
    case 'running':
    case 'validating':
      return 'badge-warning';
    case 'failed':
    case 'invalid':
      return 'badge-error';
    case 'queued':
    case 'pending':
      return 'badge-info';
    default:
      return 'badge-neutral';
  }
}

export function riskColor(level?: string): string {
  switch (level) {
    case 'High': return '#ef4444';
    case 'Moderate': return '#f59e0b';
    default: return '#10b981';
  }
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

export const CHART_COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#22c55e'];
