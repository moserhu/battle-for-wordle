import React, { useState } from 'react';
import '../styles/LoginRegister.css';

export default function LoginRegister({ onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogin = async () => {
    setError('');
    const res = await fetch('http://localhost:8000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: formData.email, password: formData.password }),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('user_id', data.user_id);
      localStorage.setItem('first_name', data.first_name);
      onLoginSuccess(data.user_id);
    } else {
      setError(data.detail || 'Login failed.');
    }
  };

  const handleRegister = async () => {
    setError('');
  
    const { email, password, first_name, last_name, phone } = formData;
  
    // Check for missing fields
    if (!email || !password || !first_name || !last_name || !phone) {
      setError('⚠️ Please fill out all fields.');
      return;
    }
  
    // Optional: Validate phone and email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;
  
    if (!emailRegex.test(email)) {
      setError('⚠️ Please enter a valid email address.');
      return;
    }
  
    if (!phoneRegex.test(phone)) {
      setError('⚠️ Phone number must be 10 digits.');
      return;
    }
  
    try {
      const res = await fetch('http://localhost:8000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
  
      const data = await res.json();
  
      if (res.ok) {
        setError('✅ Registered! Please login.');
        setMode('login');
      } else {
        if (data.detail?.includes('email')) {
          setError('⚠️ Email already registered.');
        } else if (data.detail?.includes('phone')) {
          setError('⚠️ Phone number already registered.');
        } else {
          setError(data.detail || 'Registration failed.');
        }
      }
    } catch (err) {
      setError('🚨 Something went wrong. Please try again.');
    }
  };
  

  return (
    <div className="login-register-container">
      {/* Toggle Mode */}
      <div className="toggle-buttons">
        {mode === 'register' ? (
          <button onClick={() => setMode('login')} className="toggle-button">← Go to Login</button>
        ) : (
          <button onClick={() => setMode('register')} className="toggle-button">→ Go to Register</button>
        )}
      </div>

      {/* Forms */}
      <div className="form-fields">
        {mode === 'login' ? (
          <>
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="input-field" />
            <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} className="input-field" />
            <button onClick={handleLogin} className="submit-button">Login</button>
          </>
        ) : (
          <>
            <input type="text" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} className="input-field" />
            <input type="text" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} className="input-field" />
            <input type="tel" name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} className="input-field" />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="input-field" />
            <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} className="input-field" />
            <button onClick={handleRegister} className="submit-button">Register</button>
          </>
        )}

        {error && <p className={`message ${error.startsWith('✅') ? 'success' : 'error'}`}>{error}</p>}
      </div>
    </div>
  );
}
