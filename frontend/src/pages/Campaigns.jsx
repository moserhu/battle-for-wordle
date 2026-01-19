// frontend/src/pages/Campaigns.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/Campaigns.css'; // ✅ new stylesheet for this page

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [cycleLength, setCycleLength] = useState(5);
  const [isAdminCampaign, setIsAdminCampaign] = useState(false);

  const { user, token, isAuthenticated, loading } = useAuth();
  const isAdmin = Boolean(user?.is_admin);

  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!user?.user_id) return;
      const searchParams = new URLSearchParams(window.location.search);
      const manageMode = searchParams.get('manage') === '1';

      const res = await fetch(`${API_BASE}/api/user/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        if (!manageMode && data.length === 1 && data[0]?.campaign_id) {
          navigate(`/campaign/${data[0].campaign_id}`);
          return;
        }
        setCampaigns(data);
      } else {
        setCampaigns([]);
      }
    };

    if (!loading && token) {
      fetchCampaigns();
    }
  }, [user, token, loading, navigate]);

  if (loading) return null;

  const handleCreate = async () => {
  const res = await fetch(`${API_BASE}/api/campaign/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: campaignName,
      cycle_length: parseInt(cycleLength),
      is_admin_campaign: isAdmin ? isAdminCampaign : false
    })
  });

  const data = await res.json();
  if (res.ok) {
    setShowCreateModal(false);
    setCampaignName('');
    setCycleLength(5);
    setIsAdminCampaign(false);
    // navigate to the new campaign's game screen
    if (data.campaign_id) {
      navigate(`/game?campaign_id=${data.campaign_id}`);
    } else {
      navigate('/game');
    }
  } else {
    alert(data.detail || 'Create failed');
  }
};

const handleJoin = async () => {
  const res = await fetch(`${API_BASE}/api/campaign/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ invite_code: inviteCode })
  });

  const data = await res.json();
  if (res.ok) {
    setShowJoinModal(false);
    setInviteCode('');
    // API returns campaign_id from join_campaign()
    if (data.campaign_id) {
      navigate(`/game?campaign_id=${data.campaign_id}`);
    } else {
      navigate('/game');
    }
  } else {
    alert(data.detail || 'Join failed');
  }
};

  return (
    <div className="campaigns-wrapper">
      {/* HERO */}
      <section className="campaigns-hero card">
        <div className="hero-content">
          <h1 className="main-title">Your Campaigns</h1>
          <p className="hero-tagline">
            Join or create campaigns, then jump into your dashboard, game, or leaderboard.
          </p>
          <div className="hero-ctas">
            <button className="btn" onClick={() => setShowJoinModal(true)}>Join Campaign</button>
            <button className="btn" onClick={() => { setShowCreateModal(true); setIsAdminCampaign(false); }}>Create Campaign</button>
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="campaigns-grid">
        {/* Left: Campaign list */}
        <div className="card">
          <h2>Your Campaigns</h2>
          {campaigns.length === 0 ? (
            <p>You’re not in any campaigns yet. Use the buttons above to get started.</p>
          ) : (
            <div className="campaign-rows">
              {campaigns.map((camp) => (
                <div
                  className={`campaign-row${camp.is_admin_campaign ? " admin-campaign" : ""}`}
                  key={camp.campaign_id}
                >
                  <div className="campaign-row-name">
                    <span>{camp.name}</span>
                  </div>
                  <div className="campaign-row-status">
                    Completed: {camp.daily_completed === 1 || camp.daily_completed === true ? "✅" : "❌"}
                  </div>
                  <div className="campaign-row-actions">
                    <button
                      className="campaign-row-action"
                      onClick={() => navigate(`/game?campaign_id=${camp.campaign_id}`)}
                      type="button"
                      aria-label={`Play ${camp.name}`}
                      title="Play"
                    >
                      <span className="campaign-action-icon">▶</span>
                    </button>
                    <button
                      className="campaign-row-action"
                      onClick={() => navigate(`/campaign/${camp.campaign_id}`)}
                      type="button"
                      aria-label={`Basecamp ${camp.name}`}
                      title="Basecamp"
                    >
                      <span className="campaign-action-icon">⛺</span>
                    </button>
                    <button
                      className="campaign-row-action"
                      onClick={() => navigate(`/leaderboard/${camp.campaign_id}`)}
                      type="button"
                      aria-label={`Leaderboard ${camp.name}`}
                      title="Leaderboard"
                    >
                      <span className="campaign-action-icon">🏆</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recent Activity (dummy) */}
        <div className="card">
          <h2>Recent Activity</h2>
          <ul className="activity-list">
            <li>🏆 Sir Lexicon won yesterday in <em>Guild of Vowels</em></li>
            <li>🛡️ Count Vowel activated Double Down in <em>Silent Letters</em></li>
            <li>⚔️ Duke Consonant reached 38 total troops</li>
          </ul>
        </div>

        {/* Right: Tips (dummy) */}
        <div className="card">
          <h2>Tips</h2>
          <ul>
            <li>Use vowels early to narrow the field.</li>
            <li>Double Down is high risk, high reward—time it wisely.</li>
            <li>Check your dashboard recap before guessing.</li>
          </ul>
        </div>
      </section>

            {/* Join Modal */}
      {showJoinModal && (
        <>
          <div
            className="campaigns-modal-overlay"
            onClick={() => setShowJoinModal(false)}
          />
          <div className="campaigns-modal">
            <h3 className="campaigns-modal-title">Join Campaign</h3>
            <input
              className="campaigns-modal-input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter Invite Code"
            />
            <div className="campaigns-modal-actions">
              <button className="campaigns-modal-btn primary" onClick={handleJoin}>
                Join
              </button>
              <button
                className="campaigns-modal-btn"
                onClick={() => setShowJoinModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <>
          <div
            className="campaigns-modal-overlay"
            onClick={() => { setShowCreateModal(false); setIsAdminCampaign(false); }}
          />
          <div className="campaigns-modal">
            <h3 className="campaigns-modal-title">Create Campaign</h3>

            <label className="campaigns-modal-label" htmlFor="campaignName">
              Campaign Name
            </label>
            <input
              id="campaignName"
              className="campaigns-modal-input"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />

            <label className="campaigns-modal-label" htmlFor="cycleLength">
              Number of Days
            </label>
            <div className="cycle-length-options" id="cycleLength">
              {[3, 5, 7].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`cycle-option ${Number(cycleLength) === value ? 'selected' : ''}`}
                  onClick={() => setCycleLength(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            {isAdmin && (
              <label className="campaigns-admin-toggle">
                <input
                  type="checkbox"
                  checked={isAdminCampaign}
                  onChange={(e) => setIsAdminCampaign(e.target.checked)}
                />
                Admin/Test Campaign (no global stats)
              </label>
            )}

            <div className="campaigns-modal-actions">
              <button className="campaigns-modal-btn primary" onClick={handleCreate}>
                Create
              </button>
              <button
                className="campaigns-modal-btn"
                onClick={() => { setShowCreateModal(false); setIsAdminCampaign(false); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
