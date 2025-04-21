// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import '../styles/Login.css';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'

  return (
    <div className="login-page">
        <h1 className="login-title">Battle for Wordle</h1>
      <div className="login-toggle">
        <button
          className={mode === 'login' ? 'active' : ''}
          onClick={() => setMode('login')}
        >
          Login
        </button>
        <button
          className={mode === 'register' ? 'active' : ''}
          onClick={() => setMode('register')}
        >
          Register
        </button>
      </div>

      <div className="form-container">
        {mode === 'login' ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
}
