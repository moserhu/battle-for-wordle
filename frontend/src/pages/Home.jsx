import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/Home.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function Home() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [cycleLength, setCycleLength] = useState(5);

  const { user, token, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!user?.user_id) return;

      const res = await fetch(`${API_BASE}/api/user/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await res.json();
      if (res.ok) {
        setCampaigns(data);
      }
    };

    if (!loading && token) {
      fetchCampaigns();
    }
  }, [user, token, loading]);

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
        cycle_length: parseInt(cycleLength)
      })
    });

    const data = await res.json();
    if (res.ok) {
      navigate('/game');
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
      body: JSON.stringify({ invite_code: inviteCode, user_id: user.user_id })
    });

    const data = await res.json();
    if (res.ok) {
      navigate('/game');
    } else {
      alert(data.detail || 'Join failed');
    }
  };

  return (
    <div className="home-wrapper">
      <div className="home-container">
        <h1 className='main-title'>Battle for Wordle</h1>

        {user && (
          <>
            <h2 className='sub-main-title'>Welcome, {user?.first_name || 'Player'}!</h2>
            <div className="campaign-actions">
              <button onClick={() => setShowJoinModal(true)}>Join Campaign</button>
              <button onClick={() => setShowCreateModal(true)}>Create Campaign</button>
            </div>

            {campaigns.length > 0 && (
              <div className="campaign-cards">
              {campaigns.map((camp) => (
                <div className="campaign-card" key={camp.campaign_id}>
                  <h3 className="campaign-title">{camp.name}</h3>

                  <div className="campaign-buttons">
                  <p className="campaign-day">📅  Day {camp.day} of {camp.total}</p>
                    <button
                      onClick={() => {
                        navigate(`/game?campaign_id=${camp.campaign_id}`);
                      }}
                    >
                      Play
                    </button>
                    <button
                      onClick={() => {
                        navigate(`/leaderboard/${camp.campaign_id}`);
                      }}
                    >
                      Leaderboard
                    </button>
                  <p className="campaign-status">
                    {camp.double_down_activated === 1 && camp.daily_completed === 0 ? (
                      <span className="double-down-icon pulse">⚔️ Double Down Active</span>
                    ) : (
                      camp.is_finished ? '✅ Completed' : '❌ Not Completed'
                    )}
                  </p>
                  </div>
                </div>
              ))}
            </div>
            )}
          </>
        )}

        {showJoinModal && (
          <div className="modal">
            <h3>Join Campaign</h3>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter Invite Code"
            />
            <div>
              <button onClick={handleJoin}>Join</button>
              <button onClick={() => setShowJoinModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showCreateModal && (
          <div className="modal">
            <h3>Create Campaign</h3>

            <label htmlFor="campaignName">Campaign Name</label>
            <input
              id="campaignName"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />

            <label htmlFor="cycleLength">Number of Days</label>
            <input
              id="cycleLength"
              type="number"
              min="1"
              max="30"
              value={cycleLength}
              onChange={(e) => setCycleLength(e.target.value)}
            />

            <div>
              <button onClick={handleCreate}>Create</button>
              <button onClick={() => setShowCreateModal(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
