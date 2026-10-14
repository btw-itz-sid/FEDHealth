import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

const navItems = [
  { to: '/', label: 'Overview', icon: '📊', roles: ['patient', 'researcher', 'admin'] },
  { to: '/assess', label: 'Risk Assessment', icon: '🩺', roles: ['patient', 'researcher', 'admin'] },
  { to: '/history', label: 'My History', icon: '📋', roles: ['patient', 'researcher', 'admin'] },
  { to: '/datasets', label: 'Datasets', icon: '📁', roles: ['researcher', 'admin'] },
  { to: '/experiments', label: 'Experiments', icon: '🔬', roles: ['researcher', 'admin'] },
  { to: '/compare', label: 'Compare', icon: '📈', roles: ['researcher', 'admin'] },
  { to: '/models', label: 'Models', icon: '🧠', roles: ['researcher', 'admin'] },
  { to: '/admin', label: 'Admin', icon: '⚙️', roles: ['admin'] },
  { to: '/profile', label: 'Profile', icon: '👤', roles: ['patient', 'researcher', 'admin'] },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface-secondary)]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--color-border)]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-teal-500)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">FH</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-[var(--color-text-primary)]">FedHealth</h1>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Research Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-primary)]'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-[var(--color-border)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center">
              <span className="text-sm font-semibold text-[var(--color-primary-700)]">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-red-50 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[var(--color-surface)]/80 backdrop-blur-md border-b border-[var(--color-border)] px-6 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-surface-tertiary)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex-1" />
            <span className="badge badge-info text-xs">v0.1.0</span>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
