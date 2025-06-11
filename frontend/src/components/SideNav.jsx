import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark, faExclamationCircle, faLandmark, faUserShield } from '@fortawesome/free-solid-svg-icons';
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


  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/user/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCampaigns(data);
      } else {
        setCampaigns([]);
      }
    } catch {
      setCampaigns([]);
    }
  }, [token]);
  
  useEffect(() => {
    if (open) {
      fetchCampaigns();
    }
  }, [open, fetchCampaigns]);

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
        <button className="side-nav-toggle" onClick={() => setOpen(!open)}>
          <FontAwesomeIcon icon={open ? faXmark : faBars} />
        </button>
      </div>

      {/* Sidebar Drawer */}
      <div className={`side-nav ${open ? 'open' : ''}`}>
      <div className="nav-links-scrollable">
        <button className="main-nav-btn" onClick={() => {
            navigate('/account');
            setOpen(false);
        }}>
            <FontAwesomeIcon icon={faUserShield} />
            <span className="label">Account</span>
        </button>

        <button
            className={`main-nav-btn ${!hasSeenUpdate ? 'pulse' : ''}`}
            onClick={() => {
                handleUpdateClick();
                setOpen(false);
            }}>
            <FontAwesomeIcon icon={faExclamationCircle} />
            <span className="label">Updates</span>
        </button>

        <div className="campaign-links">
            <h4 className="campaigns-header">Campaigns</h4>
            {campaigns.map((c) => (
            <div key={c.campaign_id} className="campaign-buttons">
                <span className="campaign-name">{c.name}</span>
                <div className="play-row">
                <button
                    className="campaign-action play-btn"
                    onClick={() => {
                    navigate(`/game?campaign_id=${c.campaign_id}`);
                    setOpen(false);
                    }}
                >
                    Play
                    <span className="completion-icon">
                    {c.double_down_activated === 1 && c.daily_completed === 0 ? (
                    <span className="double-down-icon pulse">⚔️</span>
                    ) : (
                    c.is_finished ? '✅' : '❌'
                    )}
                </span>
                </button>

                </div>
                <button
                className="campaign-action leaderboard-btn"
                onClick={() => {
                    navigate(`/leaderboard/${c.campaign_id}`);
                    setOpen(false);
                }}
                >
                Leaderboard
                </button>
            </div>
            ))}
        </div>
        </div>

        <div className="nav-links-fixed">
        <button className="main-home-btn" onClick={() => {
            navigate('/home');
            setOpen(false);
        }}>
            <FontAwesomeIcon icon={faLandmark} />
            <span className="label">Home</span>
        </button>
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
