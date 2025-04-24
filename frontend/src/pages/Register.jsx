import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import '../styles/Register.css';

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);


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
    const res = await fetch('http://localhost:8000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage('✅ Registered! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500); // Delay for user to see success
    } else {
      setMessage(data.detail || 'Registration failed');
    }
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
            placeholder="Phone"
            value={form.phone}
            onChange={handleChange}
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
