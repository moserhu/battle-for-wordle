// src/pages/MainLandingPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MainLanding.css';

export default function MainLandingPage() {
  const navigate = useNavigate();

  return (
    <div className="main-landing">
      <div className="landing-overlay">
        <button className="join-btn" onClick={() => navigate('/login')}>
          Join the Fight
        </button>
      </div>
    </div>
  );
}
