import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, isLoading } = useStore();
  const location = useLocation();
  if (isLoading) return <div className="route-loading" role="status">Connecting to E-Swap…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
