import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import OverviewPage from '@/features/overview/OverviewPage';
import DatasetsPage from '@/features/datasets/DatasetsPage';
import ExperimentsPage from '@/features/experiments/ExperimentsPage';
import ExperimentDetailPage from '@/features/experiments/ExperimentDetailPage';
import ModelsPage from '@/features/models/ModelsPage';
import AdminPage from '@/features/admin/AdminPage';
import AssessPage from '@/features/assess/AssessPage';
import HistoryPage from '@/features/history/HistoryPage';
import ProfilePage from '@/features/profile/ProfilePage';
import ComparePage from '@/features/compare/ComparePage';

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
    <Routes>
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
    </Routes>
  );
}
