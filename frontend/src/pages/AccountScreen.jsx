import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/AccountScreen.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function AccountScreen() {
  
  const [user, setUser] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    campaigns: 0,
    total_guesses: 0,
    correct_guesses: 0,
    campaign_wins: 0,
    campaign_losses: 0,
  });

  const [originalUser, setOriginalUser] = useState({});
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [campaignsOwned, setCampaignsOwned] = useState([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [kickList, setKickList] = useState([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const navigate = useNavigate();
  const { user: authUser, token, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!isAuthenticated || !authUser?.user_id)) {
      navigate('/login');
    }
  }, [loading, isAuthenticated, authUser, navigate]);

  useEffect(() => {
    const fetchUser = async () => {
      const res = await fetch(`${API_BASE}/api/user/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setOriginalUser(data);
      }
    };

    if (!loading && token) {
      fetchUser();
    }
  }, [loading, token]);

  const fetchOwnedCampaigns = React.useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/campaigns/owned`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setCampaignsOwned(data);
    }
  }, [token]);

  useEffect(() => {
    if (token && authUser?.user_id) {
      fetchOwnedCampaigns();
    }
  }, [authUser?.user_id, fetchOwnedCampaigns, token]);
  
  


  if (loading) return null;

  const handleChange = (e) => {
    setUser((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    const res = await fetch(`${API_BASE}/api/user/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: authUser.user_id, ...user }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage('✅ Info updated');
      setOriginalUser(user);
      setEditing(false);
    } else {
      setMessage(data.detail || '⚠️ Update failed');
    }
  };

  const hasChanges = JSON.stringify(user) !== JSON.stringify(originalUser);

  const formatPhoneNumber = (phone) => {
    const cleaned = ('' + phone).replace(/\D/g, '');
    if (cleaned.length === 10) {
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
      return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
    }
    return phone; // fallback for non-standard lengths
  };
  

  return (
    <div className="account-wrapper">
      <div className="account-screen">
        <button onClick={() => navigate('/home')} className="back-btn">← Back to Home</button>
        <h2>My Account</h2>

        <div className="account-info">
          {!editing ? (
            <>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>First Name:</strong> {user.first_name}</p>
              <p><strong>Last Name:</strong> {user.last_name}</p>
              <p><strong>Phone:</strong> {formatPhoneNumber(user.phone)}</p>
              <button onClick={() => setEditing(true)} className="edit-btn">Make Changes</button>
            </>
          ) : (
            <>
              <label>Email (unchangeable)</label>
              <input type="email" value={user.email} disabled />

              <label>First Name</label>
              <input name="first_name" value={user.first_name} onChange={handleChange} />

              <label>Last Name</label>
              <input name="last_name" value={user.last_name} onChange={handleChange} />

              <label>Phone</label>
              <input name="phone" value={user.phone} onChange={handleChange} />

              {hasChanges && <button onClick={handleSave} className="save-btn">Save Changes</button>}
              <button onClick={() => setEditing(false)} className="cancel-btn">Cancel</button>
              {message && <p className="message">{message}</p>}
            </>
          )}
        </div>

        <div className="account-highlights">
          <h3>Campaign Highlights</h3>
          <div className="highlight-box">
            <p>Campaigns joined: {user.campaigns}</p>
            <p>Total guesses: {user.total_guesses}</p>
            <p>Correct guesses: {user.correct_guesses}</p>
            <p>Victories: {user.campaign_wins}</p>
            <p>Losses: {user.campaign_losses}</p>
          </div>
          <button className='management-btn' onClick={() => { setShowCampaignModal(true); }}>
  🛠️ Campaign Management
</button>

{showCampaignModal && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>Your Campaigns</h3>
      {campaignsOwned.length === 0 ? <p>No owned campaigns.</p> : campaignsOwned.map((camp) => (
        <div key={camp.id} className="campaign-entry">
        <strong>{camp.name}</strong>
          <div className="campaign-actions">
          <button onClick={() => {
              setSelectedCampaign(camp);
              setConfirmingDelete(true);
            }}>Delete</button>
            <button onClick={async () => {
              const res = await fetch(`${API_BASE}/api/campaign/members`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ campaign_id: camp.id }),
              });
              const data = await res.json();
  if (res.ok) {
    setKickList(data);
    setSelectedCampaign(camp);
    setConfirmingDelete(false); // ✅ make sure this is false if switching
  }
            }}>Kick Players</button>
          </div>
        </div>
      ))}

      {/* Delete confirmation */}
      {selectedCampaign && confirmingDelete && (
        <>
          <p>
            Type <strong className="campaign-name-highlight">{selectedCampaign.name}</strong> to confirm deletion <em>(case-insensitive)</em>:
          </p>
          <input
            value={confirmDeleteName}
            onChange={(e) => setConfirmDeleteName(e.target.value)}
          />
          <button
            disabled={confirmDeleteName.trim().toLowerCase() !== selectedCampaign.name.toLowerCase()}
            onClick={async () => {
              const res = await fetch(`${API_BASE}/api/campaign/delete`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ campaign_id: selectedCampaign.id }),
              });
              if (res.ok) {
                alert("Deleted!");
                setSelectedCampaign(null);
                setConfirmDeleteName('');
                setKickList([]);
                fetchOwnedCampaigns();
              }
            }}
          >
            Confirm Delete
          </button>
        </>
      )}

      {/* Kick list */}
      {kickList.length > 0 && (
  <div className="kick-list">
    <h4>Kick players from {selectedCampaign.name}</h4>
    {kickList.map((player) => (
      <div key={player.user_id || player.name}>
        {player.name}
        <button onClick={async () => {
          await fetch(`${API_BASE}/api/campaign/kick`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              campaign_id: selectedCampaign.id,
              user_id: player.user_id,
            }),
          });
          setKickList(kickList.filter((p) => p.user_id !== player.user_id));
        }}>🥾</button>
      </div>
    ))}
  </div>
)}


      <button onClick={() => {
        setShowCampaignModal(false);
        setSelectedCampaign(null);
        setKickList([]);
      }}>Close</button>
    </div>
  </div>
)}
        </div>
      </div>
    </div>
  );
}
