import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import GlobalLeaderboard from '../components/GlobalLeaderboard';
import '../styles/Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();

  // Auth gate
  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  if (loading) return null;

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="home-wrapper">
      {/* HERO */}
      <section className="home-hero home-card home-card--hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="main-title">Battle for Wordle</h1>
            <p className="hero-tagline">
              Daily campaigns. Rivalries. Glory. Rally your troops and claim the throne.
            </p>
          </div>
          <div className="hero-ctas">
            <button className="btn primary" onClick={() => navigate('/campaigns')}>
              Go to Campaigns
            </button>
            <button className="btn ghost" onClick={() => navigate('/account')}>
              Account
            </button>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <div className="home-card home-quick-card">
        <div className="home-quick-actions">
          <button className="home-quick-btn" onClick={() => navigate('/campaigns')}>
            Campaigns
          </button>
          <button className="home-quick-btn" onClick={() => scrollToSection('home-leaderboard')}>
            Leaderboard
          </button>
          <button className="home-quick-btn" onClick={() => scrollToSection('home-updates')}>
            Updates
          </button>
        </div>
      </div>

      {/* CONTENT LAYOUT */}
      <section className="home-layout">
        <div className="home-primary">
          <div className="home-card home-leaderboard-card" id="home-leaderboard">
            <div className="home-section-header">
              <h2>Global Leaderboard</h2>
            </div>
            <GlobalLeaderboard />
          </div>
        </div>

        <aside className="home-sidebar">
          <div className="home-card home-news-card" id="home-updates">
            <div className="home-section-header">
              <h2>News &amp; Highlights</h2>
            </div>
            <p>
              Welcome, {user?.first_name || 'Player'}! Check out all the latest updates below:
            </p>
            <ul className="home-news-list">
              <li>Current Ruler banners now crown each campaign</li>
              <li>Campaign streaks track daily consistency and unlock shop perks</li>
              <li>Coins economy is live with per-guess rewards and pity coins</li>
              <li>Info modals explain Double Down, Coins, and Streaks</li>
              <li>Global leaderboard now toggles Top 10, 50, and 100</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
