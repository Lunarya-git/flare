import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wraps a route element; redirects unauthenticated users to /login.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="main-content">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
