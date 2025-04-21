import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import '../styles/Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(localStorage.getItem('user_id'));
  const [campaigns, setCampaigns] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [campaignName, setCampaignName] = useState('');

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!userId) return;
      const res = await fetch('http://localhost:8000/api/user/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId) }),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaigns(data);
      }
    };
    fetchCampaigns();
  }, [userId]);

  const handleCreate = async () => {
    const res = await fetch('http://localhost:8000/api/campaign/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: campaignName, user_id: parseInt(userId) }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('campaign_id', data.campaign_id);
      alert(`Invite code: ${data.invite_code}`);
      navigate('/game');
    } else {
      alert(data.detail || 'Create failed');
    }
  };

  const handleJoin = async () => {
    const res = await fetch('http://localhost:8000/api/campaign/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: inviteCode, user_id: parseInt(userId) }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('campaign_id', data.campaign_id);
      navigate('/game');
    } else {
      alert(data.detail || 'Join failed');
    }
  };

  const logout = () => {
    localStorage.clear();
    setUserId(null);
    setCampaigns([]);
    setInviteCode('');
    setCampaignName('');
    navigate('/login');
  };

  return (
    <div className="home-wrapper">
      {userId && (
          <div className="top-buttons">
            <button className="account-button" onClick={() => navigate('/account')}>
              <FontAwesomeIcon icon={faUserCircle} />
            </button>
            <button className="logout-button" onClick={logout}>
              <FontAwesomeIcon icon={faSignOutAlt} />
            </button>
          </div>
        )}
      <div className="home-container">
        
        <h1>Battle for Wordle</h1>
  
        {userId ? (
          <>
            <h2>Welcome, {localStorage.getItem('first_name') || 'Player'}!</h2>
            <div className="campaign-actions">
              <button onClick={() => setShowJoinModal(true)}>Join Campaign</button>
              <button onClick={() => setShowCreateModal(true)}>Create Campaign</button>
            </div>
  
            {campaigns.length > 0 && (
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Completed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((camp) => (
                    <tr key={camp.campaign_id}>
                      <td>{camp.name}</td>
                      <td>{camp.is_finished ? '✅' : '❌'}</td>
                      <td>
                        <button
                          onClick={() => {
                            localStorage.setItem('campaign_id', camp.campaign_id);
                            navigate('/game');
                          }}
                        >
                          Play
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : null}
  
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
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Campaign Name"
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