// src/auth/RedirectIfAuthenticated.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/home');
    }
  }, [loading, isAuthenticated, navigate]);

  // While loading (e.g., fetching token), don't render or redirect yet
  if (loading) return null;

  return children;
}
