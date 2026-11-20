import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
const OverviewPage = lazy(() => import('@/features/overview/OverviewPage'));
const DatasetsPage = lazy(() => import('@/features/datasets/DatasetsPage'));
const ExperimentsPage = lazy(() => import('@/features/experiments/ExperimentsPage'));
const ExperimentDetailPage = lazy(() => import('@/features/experiments/ExperimentDetailPage'));
const ModelsPage = lazy(() => import('@/features/models/ModelsPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));
const AssessPage = lazy(() => import('@/features/assess/AssessPage'));
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const ComparePage = lazy(() => import('@/features/compare/ComparePage'));

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-surface-secondary)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<div className="p-8" role="status">Loading workspace…</div>}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="assess" element={<AssessPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="compare" element={<ProtectedRoute roles={['researcher', 'admin']}><ComparePage /></ProtectedRoute>} />
        <Route path="datasets" element={<ProtectedRoute roles={['researcher', 'admin']}><DatasetsPage /></ProtectedRoute>} />
        <Route path="experiments" element={<ProtectedRoute roles={['researcher', 'admin']}><ExperimentsPage /></ProtectedRoute>} />
        <Route path="experiments/:id" element={<ProtectedRoute roles={['researcher', 'admin']}><ExperimentDetailPage /></ProtectedRoute>} />
        <Route path="models" element={<ProtectedRoute roles={['researcher', 'admin']}><ModelsPage /></ProtectedRoute>} />
        <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  );
}
