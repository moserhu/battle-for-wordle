// src/auth/RedirectIfAuthenticated.jsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = searchParams.get("redirectTo");

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(redirectTo || '/home', { replace: true });
    }
  }, [loading, isAuthenticated, navigate, redirectTo]);

  if (loading) return null;

  return children;
}
