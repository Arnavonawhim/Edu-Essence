import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/* Logged-out visitors are denied; a wrong role is sent to its own session page. */
export default function RequireAuth({ role, children }) {
  const { status, isAuthenticated, role: currentRole } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <p className="page-note">Checking your session…</p>;

  if (!isAuthenticated) {
    return <Navigate to="/join" replace state={{ denied: true, from: location.pathname }} />;
  }

  if (role && currentRole !== role) {
    return <Navigate to="/join" replace />;
  }

  return children;
}
