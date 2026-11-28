import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import Brand from '@/components/ui/Brand';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="auth-shell">
    <aside className="auth-story">
      <Brand inverse />
      <div>
        <div className="auth-story-copy"><p className="eyebrow" style={{ color: '#aabcb5', marginBottom: 22 }}>Federated learning for healthcare</p><h1>Learn together.<br />Keep the data<br /><em>close to home.</em></h1><p>A research workspace for exploring how hospitals can train a shared model through local learning.</p></div>
        <div className="auth-network" aria-label="Three local hospital trainers connected to a common model">
          <svg viewBox="0 0 440 175" fill="none" role="img"><title>Common model, local training, shared updates</title>
            <path d="M70 120V88h150V55 M220 120V55 M370 120V88H220" stroke="#637d73" strokeWidth="1" />
            <rect x="162" y="14" width="116" height="42" rx="7" stroke="#849c91"/><text x="220" y="40" fill="#e4ede5" fontSize="12" textAnchor="middle" fontFamily="inherit">Global model</text>
            {[['A', 18], ['B', 168], ['C', 318]].map(([name, x]) => <g key={name}><rect x={Number(x)} y="120" width="104" height="45" rx="7" stroke="#607a6f"/><text x={Number(x)+52} y="138" fill="#d4e1d6" fontSize="11" textAnchor="middle" fontFamily="inherit">Hospital {name}</text><text x={Number(x)+52} y="153" fill="#91a89b" fontSize="9" textAnchor="middle" fontFamily="inherit">LOCAL TRAINING</text></g>)}
            <circle cx="220" cy="88" r="3" fill="#b7c8b5" />
          </svg>
        </div>
      </div>
      <div className="auth-story-footer"><span>Public-data research simulation</span><span>Built to make the learning visible.</span></div>
    </aside>
    <main className="auth-form-side"><div className="auth-form"><div className="mobile-brand"><Brand /></div>{children}<p className="mt-6 text-xs text-[var(--color-text-muted)]"><Link to="/privacy" className="underline">Data & privacy</Link></p></div></main>
  </div>;
}
