// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../auth/AuthProvider';
import '../styles/Login.css';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = searchParams.get("redirectTo") || "/home";

  const handleLogin = async () => {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  
    const data = await res.json();
  
    if (res.ok) {
      login(data.user, data.access_token);
      navigate(redirectTo);  // 👈 use redirect param
    } else {
      setError(data.detail || 'Login failed');
    }
  };
  
  

  return (
    <div className="login-page">
      <div className="form-container">
        <div className="login-form">
          <h2>Login</h2>
          {error && <p className="error">{error}</p>}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <div className="password-input-wrapper">
          <input
           type={showPassword ? 'text' : 'password'}
           value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <span
            className="toggle-password"
            onClick={() => setShowPassword((prev) => !prev)}
          >
         <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
        </span>
          </div>
          <button onClick={handleLogin}>Login</button>
          <p className="small-link">
            Don’t have an account?{" "}
          <Link to={`/register?redirectTo=${encodeURIComponent(redirectTo)}`}>
           Register
          </Link>
            </p>
        </div>
      </div>
    </div>
  );
}
