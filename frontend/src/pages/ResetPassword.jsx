import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/Login.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || '';
  }, [location.search]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setStatus('');

    if (!token) {
      setError('Missing reset token. Please request a new reset email.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.detail || 'Reset failed. Please request a new reset link.');
        return;
      }

      setStatus('Password updated. Redirecting to login…');
      setTimeout(() => navigate('/login'), 900);
    } catch (e) {
      setError('Reset failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-page">
      <div className="form-container">
        <div className="login-form">
          <h2>Choose a new password</h2>
          {error && <p className="error">{error}</p>}
          {status && <p style={{ color: '#cfe9cf' }}>{status}</p>}

          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
          />

          <button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Reset Password'}
          </button>

          <p className="small-link">
            <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
