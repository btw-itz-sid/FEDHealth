import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Suspense, useEffect, useRef, useState } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';
import Brand from '@/components/ui/Brand';


const groups: { label: string; items: { to: string; label: string; icon: IconName; roles?: string[] }[] }[] = [
  { label: 'Workspace', items: [{ to: '/', label: 'Home', icon: 'grid' }, { to: '/assess', label: 'New assessment', icon: 'pulse' }, { to: '/history', label: 'My history', icon: 'clock' }] },
  { label: 'Research', items: [{ to: '/experiments', label: 'Train model', icon: 'flask' }, { to: '/compare', label: 'Results', icon: 'chart' }].map(item => ({ ...item, icon: item.icon as IconName, roles: ['researcher', 'admin'] })) },
  { label: 'Advanced tools', items: [{ to: '/datasets', label: 'Datasets', icon: 'database', roles: ['researcher', 'admin'] }, { to: '/models', label: 'Model registry', icon: 'layers', roles: ['researcher', 'admin'] }, { to: '/profile', label: 'Account settings', icon: 'settings' }, { to: '/admin', label: 'Administration', icon: 'users', roles: ['admin'] }] },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  const pageTitle = groups.flatMap(group => group.items).find(item => item.to === pathname)?.label ?? (pathname.startsWith('/experiments/') ? 'Training details' : 'Workspace');
  useEffect(() => { window.scrollTo(0, 0); setSidebarOpen(false); setAdvancedOpen(!!groups.find(group=>group.label==='Advanced tools')?.items.some(item=>item.to===pathname)); }, [pathname]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.activeElement as HTMLElement;
    const controls = () => [...(navigation.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [])];
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [sidebarOpen]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSidebarOpen(false); } };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [sidebarOpen]);
  return <div className="app-shell">
    <a href="#main-content" className="sr-skip">Skip to content</a>
    {sidebarOpen && <button className="fixed inset-0 z-40 bg-black/20" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside ref={navigation} className={`sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="Workspace navigation" role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen || undefined}>
      <div className="flex items-center justify-between"><Brand /><button className="icon-button mobile-menu-button mb-8" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><Icon name="close" /></button></div>
      <nav className="sidebar-scroll">{groups.map((group) => {
        const items = group.items.filter((item) => !item.roles || item.roles.includes(user?.role ?? ''));
        const advanced = group.label === 'Advanced tools';
        const expanded = advancedOpen;
        return items.length ? <div key={group.label}>{advanced ? <button className="nav-link w-full mt-5" onClick={() => setAdvancedOpen(!expanded)} aria-expanded={expanded}><Icon name="settings" size={18}/><span>Advanced tools</span><Icon name="chevronDown" size={14} className="ml-auto"/></button> : <p className="nav-label">{group.label}</p>}{(!advanced || expanded) && <>{items.map((item) => <NavLink to={item.to} end={item.to === '/'} key={item.to} className={({ isActive }) => `nav-link ${isActive || (item.to === '/experiments' && pathname.startsWith('/experiments/')) ? 'active' : ''}`}><Icon name={item.icon} size={18} /><span>{item.label}</span>{pathname === item.to && <span className="nav-current" />}</NavLink>)}</>}</div> : null;
      })}</nav>
      <div className="sidebar-bottom"><div className="user-identity"><span className="avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</span><div className="min-w-0"><p className="text-[13px] font-medium truncate">{user?.firstName} {user?.lastName}</p><p className="text-xs text-[var(--color-text-muted)] capitalize">{user?.role} workspace</p></div><button className="icon-button ml-auto" onClick={async () => { await logout(); navigate('/login'); }} aria-label="Sign out" title="Sign out"><Icon name="logout" size={18} /></button></div></div>
    </aside>
    <div className="workspace-main">
      <header className="workspace-topbar"><div className="flex items-center gap-3"><button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" aria-expanded={sidebarOpen}><Icon name="menu" /></button><div className="breadcrumb"><span>FedHealth</span><Icon name="chevron" size={12} /><strong>{pageTitle}</strong></div></div><div className="topbar-actions"><Link to="/profile" aria-label="My account" className="btn-quiet"><Icon name="user" size={16} /><span className="hidden sm:inline">My account</span></Link></div></header>
      <main id="main-content" className="workspace-content" tabIndex={-1}><Suspense fallback={<p role="status">Loading page…</p>}><Outlet /></Suspense></main>
    </div>
  </div>;
}
