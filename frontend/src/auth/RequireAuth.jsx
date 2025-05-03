import { useAuth } from './AuthProvider';
import { Navigate } from 'react-router-dom';

export default function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // or a spinner

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
