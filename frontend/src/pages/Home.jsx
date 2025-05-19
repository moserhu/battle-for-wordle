import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../auth/AuthProvider';
import UpdateLog from '../components/UpdateLog';
import '../styles/Home.css';

const API_BASE = `${window.location.protocol}//${window.location.hostname}`;

export default function Home() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [cycleLength, setCycleLength] = useState(5); 
  const [hasSeenUpdate, setHasSeenUpdate] = useState(true); // default to true until fetched

  const { user, token, logout, isAuthenticated, loading } = useAuth();

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
  
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!token || !user) return;
  
      const res = await fetch(`${API_BASE}/api/user/info`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      const data = await res.json();
      if (res.ok) {
        setHasSeenUpdate(data.clicked_update === 1);
      }
    };
  
    fetchUserInfo();
  }, [token, user]);
  
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
      localStorage.setItem('campaign_id', data.campaign_id);
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
      localStorage.setItem('campaign_id', data.campaign_id);
      navigate('/game');
    } else {
      alert(data.detail || 'Join failed');
    }
  };

  return (
    <div className="home-wrapper">
      {user && (
          <div className="top-buttons">
          <button
            className={`update-button ${!hasSeenUpdate ? 'pulse' : ''}`}
            onClick={async () => {
              setShowUpdateModal(true);
              if (!hasSeenUpdate) {
                await fetch(`${API_BASE}/api/user/acknowledge_update`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });
                setHasSeenUpdate(true);
              }
            }}
          >
            <FontAwesomeIcon icon={faExclamationCircle} />
          </button>
            <button className="account-button" onClick={() => navigate('/account')}>
              <FontAwesomeIcon icon={faUserCircle} />
            </button>
            <button className="logout-button" onClick={logout}>
           <FontAwesomeIcon icon={faSignOutAlt} />
            </button>
          </div>
        )}
      <div className="home-container">
        
        <h1 className='main-title'>Battle for Wordle</h1>
  
        {user ? (
          <>
            <h2 className='sub-main-title'>Goodbye, {user?.first_name || 'Player'}!</h2>
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
                  <th colSpan={2}>Actions</th>
                </tr>
                </thead>
                <tbody>
                  {campaigns.map((camp) => (
                    <tr key={camp.campaign_id}>
                      <td>{camp.name}</td>
                      <td>
                        {camp.double_down_activated === 1 && camp.daily_completed === 0 ? (
                          <span className="double-down-icon pulse">⚔️</span>
                        ) : (
                          camp.is_finished ? '✅' : '❌'
                        )}
                      </td>
                      <td colSpan={2}>
                        <div className="campaign-buttons">
                          <button
                            onClick={() => {
                              localStorage.setItem('campaign_id', camp.campaign_id);
                              navigate(`/leaderboard/${camp.campaign_id}`);
                            }}
                          >
                            Leaderboard
                          </button>
                          <button
                            onClick={() => {
                              localStorage.setItem('campaign_id', camp.campaign_id);
                              navigate('/game');
                            }}
                          >
                            Play
                          </button>
                        </div>
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
      {showUpdateModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowUpdateModal(false)} />
          <div className="modal">
            <h3>Recent Updates</h3>
            <UpdateLog />
            <button onClick={() => setShowUpdateModal(false)}>Close</button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
