import { Link } from 'react-router-dom';

export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link to="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} aria-label="FedHealth home">
    <svg viewBox="0 0 32 32" width="34" height="34" fill="none" aria-hidden="true"><path d="M4 16h6l3-7 6 14 3-7h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="1" y="1" width="30" height="30" rx="9" stroke="currentColor" strokeWidth="1.2"/></svg>
    <span>FedHealth<span className="brand-caption">RESEARCH WORKSPACE</span></span>
  </Link>;
}
