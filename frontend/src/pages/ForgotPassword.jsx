import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Login.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = searchParams.get('redirectTo') || '/home';

  const handleSubmit = async () => {
    setError('');
    setStatus('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Always show success copy (avoid account enumeration)
      if (!res.ok) {
        // Still don't leak details.
        setStatus('If that email exists, a reset link has been sent.');
        return;
      }

      setStatus('If that email exists, a reset link has been sent.');
    } catch (e) {
      setError('Failed to submit request. Please try again.');
    }
  };

  return (
    <div className="login-page">
      <div className="form-container">
        <div className="login-form">
          <h2>Reset Password</h2>
          {error && <p className="error">{error}</p>}
          {status && <p style={{ color: '#cfe9cf' }}>{status}</p>}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />

          <button onClick={handleSubmit}>Send Reset Link</button>

          <p className="small-link">
            <Link to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
