// frontend/src/pages/Campaigns.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import ShareCard from '../components/ShareCard';
import '../styles/Campaigns.css'; // ✅ new stylesheet for this page

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCampaign, setInviteCampaign] = useState(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageCampaign, setManageCampaign] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [kickList, setKickList] = useState([]);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [cycleLength, setCycleLength] = useState(5);
  const [isAdminCampaign, setIsAdminCampaign] = useState(false);
  const [ownedCampaigns, setOwnedCampaigns] = useState([]);

  const { user, token, isAuthenticated, loading } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const ownedIds = useMemo(() => new Set(ownedCampaigns.map((c) => c.id)), [ownedCampaigns]);

  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  const fetchCampaigns = useCallback(async () => {
      if (!user?.user_id) return;
      const res = await fetch(`${API_BASE}/api/user/campaigns`, {
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
  }, [user, token]);

  const fetchOwnedCampaigns = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const res = await fetch(`${API_BASE}/api/campaigns/owned`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setOwnedCampaigns(data);
      } else {
        setOwnedCampaigns([]);
      }
    } catch {
      setOwnedCampaigns([]);
    }
  }, [user, token]);

  useEffect(() => {
    if (!loading && token) {
      fetchCampaigns();
      fetchOwnedCampaigns();
    }
  }, [user, token, loading, fetchCampaigns, fetchOwnedCampaigns]);

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

  const handleRename = async () => {
    if (!manageCampaign) return;
    const res = await fetch(`${API_BASE}/api/campaign/update_name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        campaign_id: manageCampaign.campaign_id,
        name: renameValue,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.detail || 'Rename failed');
      return;
    }
    await fetchCampaigns();
    setShowManageModal(false);
  };

  const handleLoadMembers = async () => {
    if (!manageCampaign) return;
    const res = await fetch(`${API_BASE}/api/campaign/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ campaign_id: manageCampaign.campaign_id }),
    });
    const data = await res.json();
    if (res.ok) {
      setKickList(data);
    } else {
      alert(data?.detail || 'Failed to load members');
    }
  };

  const handleKick = async (userId) => {
    if (!manageCampaign) return;
    const res = await fetch(`${API_BASE}/api/campaign/kick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ campaign_id: manageCampaign.campaign_id, user_id: userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setKickList((prev) => prev.filter((p) => p.user_id !== userId));
    } else {
      alert(data?.detail || 'Kick failed');
    }
  };

  const handleDelete = async () => {
    if (!manageCampaign) return;
    const res = await fetch(`${API_BASE}/api/campaign/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ campaign_id: manageCampaign.campaign_id }),
    });
    if (res.ok) {
      await fetchCampaigns();
      await fetchOwnedCampaigns();
      setShowManageModal(false);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data?.detail || 'Delete failed');
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
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_BASE}/api/campaign/progress`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ campaign_id: camp.campaign_id }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setInviteCampaign({
                              id: camp.campaign_id,
                              name: camp.name,
                              invite_code: data?.invite_code || "",
                            });
                            setShowInviteModal(true);
                          }
                        } catch {}
                      }}
                      type="button"
                      aria-label={`Invite to ${camp.name}`}
                      title="Invite"
                    >
                      <span className="campaign-action-icon">✉️</span>
                    </button>
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
                    {ownedIds.has(camp.campaign_id) && (
                      <button
                        className="campaign-row-action"
                        onClick={() => {
                          setManageCampaign(camp);
                          setRenameValue(camp.name || '');
                          setKickList([]);
                          setConfirmDeleteName('');
                          setShowManageModal(true);
                        }}
                        type="button"
                        aria-label={`Manage ${camp.name}`}
                        title="Manage"
                      >
                        <span className="campaign-action-icon">⚙️</span>
                      </button>
                    )}
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

      {showInviteModal && inviteCampaign && (
        <div className="campaigns-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="campaigns-modal campaigns-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button
              className="campaigns-modal-close"
              onClick={() => setShowInviteModal(false)}
              type="button"
              aria-label="Close invite"
            >
              ×
            </button>
            <ShareCard
              campaignId={inviteCampaign.id}
              campaignName={inviteCampaign.name}
              inviteCode={inviteCampaign.invite_code}
            />
          </div>
        </div>
      )}

      {showManageModal && manageCampaign && (
        <div className="campaigns-modal-overlay" onClick={() => setShowManageModal(false)}>
          <div className="campaigns-modal campaigns-manage-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="campaigns-modal-title">Manage Campaign</h3>
            <div className="campaigns-manage-section">
              <label className="campaigns-modal-label" htmlFor="renameCampaign">
                Campaign Name
              </label>
              <input
                id="renameCampaign"
                className="campaigns-modal-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
              <button className="campaigns-modal-btn primary" onClick={handleRename}>
                Save Name
              </button>
            </div>

            <div className="campaigns-manage-section">
              <div className="campaigns-manage-row">
                <h4>Members</h4>
                <button className="campaigns-modal-btn" onClick={handleLoadMembers}>
                  Load Members
                </button>
              </div>
              {kickList.length === 0 ? (
                <p className="campaigns-muted">No members loaded.</p>
              ) : (
                <div className="campaigns-kick-list">
                  {kickList.map((player) => (
                    <div key={player.user_id} className="campaigns-kick-row">
                      <span>{player.name}</span>
                      <button
                        className="campaigns-kick-btn"
                        onClick={() => handleKick(player.user_id)}
                      >
                        🥾
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="campaigns-manage-section">
              <h4>Delete Campaign</h4>
              <p className="campaigns-muted">
                Type <strong>{manageCampaign.name}</strong> to confirm deletion:
              </p>
              <input
                className="campaigns-modal-input"
                value={confirmDeleteName}
                onChange={(e) => setConfirmDeleteName(e.target.value)}
              />
              <button
                className="campaigns-modal-btn danger"
                disabled={confirmDeleteName.trim().toLowerCase() !== manageCampaign.name.toLowerCase()}
                onClick={handleDelete}
              >
                Delete Campaign
              </button>
            </div>

            <div className="campaigns-modal-actions">
              <button className="campaigns-modal-btn" onClick={() => setShowManageModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
