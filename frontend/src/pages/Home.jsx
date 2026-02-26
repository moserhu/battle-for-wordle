import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import GlobalLeaderboard from '../components/GlobalLeaderboard';
import '../styles/Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, loading } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!token || !user?.user_id) return;
      setCampaignsLoading(true);
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`}/api/user/campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          }
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setCampaigns(data);
        } else {
          setCampaigns([]);
        }
      } catch {
        setCampaigns([]);
      } finally {
        setCampaignsLoading(false);
      }
    };

    if (!loading && token) {
      fetchCampaigns();
    }
  }, [token, user, loading]);

  if (loading) return null;

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
        </div>
      </section>

      {/* YOUR CAMPAIGNS */}
      <div className="home-card home-campaigns-card">
        <div className="home-section-header">
          <h2>Your Campaigns</h2>
          <button className="btn ghost" onClick={() => navigate('/campaigns')}>
            Manage
          </button>
        </div>
        {campaignsLoading ? (
          <p>Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <p>No campaigns yet. Create or join one below.</p>
        ) : (
          <div className="home-campaign-list">
            {campaigns.map((camp) => (
              <div
                className={`home-campaign-row${camp.is_admin_campaign ? " admin-campaign" : ""}`}
                key={camp.campaign_id}
              >
                <div className="home-campaign-name">
                  <span>{camp.name}</span>
                </div>
                <div className="home-campaign-status">
                  Completed: {camp.daily_completed === 1 || camp.daily_completed === true ? "✅" : "❌"}
                </div>
                <div className="home-campaign-actions">
                  <button
                    className="home-campaign-action"
                    onClick={() => navigate(`/game?campaign_id=${camp.campaign_id}`)}
                    aria-label={`Play ${camp.name}`}
                    title="Play"
                  >
                    ▶ Play
                  </button>
                  <button
                    className="home-campaign-action"
                    onClick={() => navigate(`/campaign/${camp.campaign_id}`)}
                    aria-label={`Basecamp ${camp.name}`}
                    title="Basecamp"
                  >
                    ⛺ Basecamp
                  </button>
                  <button
                    className="home-campaign-action"
                    onClick={() => navigate(`/leaderboard/${camp.campaign_id}`)}
                    aria-label={`Leaderboard ${camp.name}`}
                    title="Leaderboard"
                  >
                    🏆 Leaderboard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
          <div className="home-card home-actions-card">
            <div className="home-section-header">
              <h2>Account & Updates</h2>
            </div>
            <div className="home-actions-buttons">
              <button className="btn" onClick={() => navigate('/account')}>
                Account
              </button>
              <button className="btn ghost" onClick={() => navigate('/updates')}>
                Update Logs
              </button>
            </div>
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
              <li>Campaign streaks track daily consistency and unlock market perks</li>
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
