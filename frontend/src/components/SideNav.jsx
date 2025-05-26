import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import UpdateLog from './UpdateLog'; // ✅ Only if you already have this component
import '../styles/SideNav.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function SideNav() {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [hasSeenUpdate, setHasSeenUpdate] = useState(true); // default to true
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Fetch campaigns
  useEffect(() => {
    fetch(`${API_BASE}/api/user/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    })
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setCampaigns(data) : setCampaigns([]))
      .catch(() => setCampaigns([]));
  }, [token]);

  // Fetch update status
  useEffect(() => {
    fetch(`${API_BASE}/api/user/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.clicked_update !== undefined) {
          setHasSeenUpdate(data.clicked_update === 1);
        }
      });
  }, [token]);

  const handleUpdateClick = async () => {
    setShowUpdateModal(true);
    if (!hasSeenUpdate) {
      await fetch(`${API_BASE}/api/user/acknowledge_update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setHasSeenUpdate(true);
    }
  };

  return (
    <>
      {/* Top-right control panel */}
      <div className="side-nav-header">
      <button
        className={`update-button ${!hasSeenUpdate ? 'pulse' : ''} ${open ? 'hidden' : ''}`}
        onClick={handleUpdateClick}
        >
          <FontAwesomeIcon icon={faExclamationCircle} />
        </button>
        <button className="side-nav-toggle" onClick={() => setOpen(!open)}>
          <FontAwesomeIcon icon={open ? faXmark : faBars} />
        </button>
      </div>

      {/* Sidebar Drawer */}
      <div className={`side-nav ${open ? 'open' : ''}`}>
        <div className="nav-links">
        <button onClick={() => {
            navigate('/home');
            setOpen(false);
            }}>
            🏠 <span className="label">Home</span>
            </button>
            <button onClick={() => {
            navigate('/account');
            setOpen(false);
            }}>
            👤 <span className="label">Account</span>
        </button>
          <div className="campaign-links">
            <h4 className="label">Your Campaigns</h4>
            {campaigns.map((c) => (
            <div key={c.campaign_id} className="campaign-buttons">
                <span className="label">{c.name}</span>
                <button
                onClick={() => {
                    if (!c.campaign_id) return; // early escape
                    navigate(`/game?campaign_id=${c.campaign_id}`);
                    setOpen(false);
                }}
                >
                <span className="label">Play</span>
                </button>
                    <button
                    onClick={() => {
                        navigate(`/leaderboard/${c.campaign_id}`);
                        setOpen(false);
                    }}
                    >
                    <span className="label">Leaderboard</span>
                    </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dimming overlay */}
      {open && <div className="side-nav-overlay" onClick={() => setOpen(false)} />}

      {/* Update modal */}
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
    </>
  );
}
