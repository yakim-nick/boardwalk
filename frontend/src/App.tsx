import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { BoardPage } from './pages/Board';

/**
 * Root router. Shows a loading spinner while the session is being restored,
 * then either the auth routes (logged out) or the app routes (logged in).
 */
export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/boards/:boardId" element={<BoardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}