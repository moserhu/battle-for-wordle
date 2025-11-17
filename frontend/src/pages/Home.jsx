import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import GlobalLeaderboard from '../components/GlobalLeaderboard';
import '../styles/Home.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function Home() {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, loading } = useAuth();

  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Auth gate
  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Pull campaigns (for the “at a glance” section)
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!token || !user?.user_id) return;
      try {
        const res = await fetch(`${API_BASE}/api/user/campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (Array.isArray(data)) setCampaigns(data);
      } catch (e) {
        console.error('Failed to load campaigns', e);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    if (!loading) fetchCampaigns();
  }, [token, user, loading]);

  if (loading) return null;

  return (
    <div className="home-wrapper">
      {/* HERO */}
      <section className="home-hero home-card">
        <div className="hero-content">
          <h1 className="main-title">Battle for Wordle</h1>
          <p className="hero-tagline">
            Daily campaigns. Rivalries. Glory. Rally your troops and claim the throne.
          </p>
          <div className="hero-ctas">
            <button className="btn primary" onClick={() => navigate('/campaigns')}>
              Go to Campaigns
            </button>
          </div>
        </div>
      </section>

      {/* CONTENT LAYOUT */}
      <section className="home-grid">
        {/* Top row: News + Global Leaderboard */}
        <div className="home-top-row">
          <div className="home-card home-news-card">
            <h2>News &amp; Highlights</h2>
            <p>
              Welcome, {user?.first_name || 'Player'}! Check out all the latest updates below:
            </p>
            <ul className="home-news-list">
              <li>Checkout layout 2.0</li>
              <li>Economy system on the way</li>
              <li>🛠️ Stores coming soon</li>
              <li>Each campaign will have its own dedicated dashboard</li>
              <li>Beware of the CLOWN</li>
            </ul>
          </div>

          <div className="home-card home-leaderboard-card">
            <h2>Global Leaderboard</h2>
            <GlobalLeaderboard />
          </div>
        </div>

        {/* Bottom row: Your Campaigns full-width */}
        <div className="home-bottom-row">
          <div className="home-card home-campaigns-card">
            <h2>Your Campaigns</h2>
            {loadingCampaigns ? (
              <p>Loading your campaigns…</p>
            ) : campaigns.length === 0 ? (
              <p>You’re not in any campaigns yet. Head to Campaigns to join or create one.</p>
            ) : (
              <div className="home-campaign-cards">
                {campaigns.slice(0, 4).map((camp) => (
                  <div className="home-campaign-card" key={camp.campaign_id}>
                    <h3 className="campaign-title">{camp.name}</h3>
                    <p className="campaign-day">📅 Day {camp.day} of {camp.total}</p>
                    <p className="campaign-status">
                      {camp.double_down_activated === 1 && camp.daily_completed === 0
                        ? <span className="double-down-icon pulse">⚔️ Double Down Active</span>
                        : (camp.is_finished ? '✅ Completed' : '❌ Not Completed')}
                    </p>
                    <div className="campaign-buttons">
                      <button onClick={() => navigate(`/campaign/${camp.campaign_id}`)}>Base Camp</button>
                      <button onClick={() => navigate(`/game?campaign_id=${camp.campaign_id}`)}>Play</button>
                      <button onClick={() => navigate(`/leaderboard/${camp.campaign_id}`)}>Leaderboard</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => navigate('/campaigns')}>
                Open Campaigns
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
