import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import '../styles/Register.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = searchParams.get("redirectTo") || "/home";

  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async () => {
    const res = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage('✅ Registered! Redirecting to login...');
        setTimeout(() => {
          navigate(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
        }, 1500);        
    } else {
      setMessage(data.detail || 'Registration failed');
    }
  };

  const formatPhoneInput = (value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  
    if (!match) return value;
  
    const [, area, middle, last] = match;
    if (area && middle && last) return `(${area}) ${middle}-${last}`;
    if (area && middle) return `(${area}) ${middle}`;
    if (area) return `(${area}`;
    return '';
  };
  
  
  return (
    <div className="login-page">
      <div className="form-container">
        <div className="register-form">
          <h2>Register</h2>
          {message && (
            <p className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
              {message}
            </p>
          )}

          <input
            name="first_name"
            placeholder="First Name"
            value={form.first_name}
            onChange={handleChange}
          />
          <input
            name="last_name"
            placeholder="Last Name"
            value={form.last_name}
            onChange={handleChange}
          />
          <input
            name="phone"
            placeholder="(###) ###-####"
            value={formatPhoneInput(form.phone)}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10); // Only digits, max 10
              setForm((prev) => ({ ...prev, phone: cleaned }));
            }}
            maxLength={14}
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />
         <div className="password-input-wrapper">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
          />
            <span
            className="toggle-password"
            onClick={() => setShowPassword((prev) => !prev)}
            >
           <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
          </span>
        </div>
          <button onClick={handleRegister}>Register</button>

          <p className="small-link">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
