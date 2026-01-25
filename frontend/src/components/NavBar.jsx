// frontend/src/components/NavBar.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLandmark, faUserShield, faRightFromBracket, faCoins, faTrophy, faCampground, faBars, faList } from '@fortawesome/free-solid-svg-icons';
import '../styles/NavBar.css';
import { useAuth } from '../auth/AuthProvider';  // ⬅️ add this

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, token, isAuthenticated, loading } = useAuth();                  // ⬅️ pull from context
  const [campaigns, setCampaigns] = useState([]);
  const [showHomeMenu, setShowHomeMenu] = useState(false);
  const [showShopMenu, setShowShopMenu] = useState(false);
  const [showPlayMenu, setShowPlayMenu] = useState(false);
  const [showLeaderboardMenu, setShowLeaderboardMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [completionByCampaign, setCompletionByCampaign] = useState({});
  const homeMenuRef = useRef(null);
  const shopMenuRef = useRef(null);
  const playMenuRef = useRef(null);
  const leaderboardMenuRef = useRef(null);
  const userMenuRef = useRef(null);

  const isActive = (pattern) => {
    if (pattern instanceof RegExp) return pattern.test(location.pathname);
    return location.pathname.startsWith(pattern);
  };
  const pathParts = location.pathname.split('/').filter(Boolean);
  const isCampaignDashboard = pathParts[0] === 'campaign' && pathParts.length === 2;
  const singleCampaign = campaigns.length === 1 ? campaigns[0] : null;

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
    } catch (_) {
      // ignore network errors
    } finally {
      // 🔑 this updates token/user + localStorage + navigates to /login
      logout();
    }
  };

  const fetchCampaigns = useCallback(async () => {
    if (loading || !isAuthenticated || !token) return;
    try {
      const res = await fetch(`${API_BASE}/api/user/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setCampaigns(list);
      const completion = {};
      list.forEach((camp) => {
        completion[camp.campaign_id] = camp.daily_completed === 1 || camp.daily_completed === true;
      });
      setCompletionByCampaign(completion);
    } catch {
      setCampaigns([]);
      setCompletionByCampaign({});
    }
  }, [loading, isAuthenticated, token]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns, location.pathname]);

  useEffect(() => {
    if (showPlayMenu || showHomeMenu || showShopMenu || showLeaderboardMenu) {
      fetchCampaigns();
    }
  }, [showPlayMenu, showHomeMenu, showShopMenu, showLeaderboardMenu, fetchCampaigns]);

  useEffect(() => {
    const handleClick = (e) => {
      if (homeMenuRef.current && !homeMenuRef.current.contains(e.target)) {
        setShowHomeMenu(false);
      }
      if (shopMenuRef.current && !shopMenuRef.current.contains(e.target)) {
        setShowShopMenu(false);
      }
      if (playMenuRef.current && !playMenuRef.current.contains(e.target)) {
        setShowPlayMenu(false);
      }
      if (leaderboardMenuRef.current && !leaderboardMenuRef.current.contains(e.target)) {
        setShowLeaderboardMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <nav className="nav-bar">
      <div className="nav-inner">
        <button
          className={`brand ${isActive('/home') ? 'brand-glow' : ''}`}
          aria-label="Home"
          title="Home"
          onClick={() => navigate('/home')}
        >
          B4W
        </button>

        <div className="nav-center">
          <div className="nav-dropdown" ref={homeMenuRef}>
            <button
              className={`icon-btn nav-primary ${isCampaignDashboard ? 'active' : ''} ${showHomeMenu ? 'menu-open' : ''}`}
              aria-label="Basecamp"
              title="Basecamp"
              onClick={() => {
                if (singleCampaign) {
                  navigate(`/campaign/${singleCampaign.campaign_id}`);
                  return;
                }
                setShowHomeMenu((prev) => !prev);
              }}
            >
              <FontAwesomeIcon icon={faCampground} />
            </button>
            {showHomeMenu && (
              <div className="nav-dropdown-menu nav-dropdown-menu-left">
                {campaigns.length === 0 ? (
                  <div className="nav-dropdown-empty">No campaigns</div>
                ) : (
                  campaigns.map((camp) => (
                    <button
                      key={camp.campaign_id}
                      className="nav-dropdown-item"
                      type="button"
                      onClick={() => {
                        setShowHomeMenu(false);
                        navigate(`/campaign/${camp.campaign_id}`);
                      }}
                    >
                      {camp.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="nav-dropdown" ref={shopMenuRef}>
            <button
              className={`icon-btn nav-primary ${isActive('/shop') || location.pathname.includes('/shop') ? 'active' : ''} ${showShopMenu ? 'menu-open' : ''}`}
              aria-label="Shop"
              title="Shop"
              onClick={() => {
                if (singleCampaign) {
                  navigate(`/campaign/${singleCampaign.campaign_id}/shop`);
                  return;
                }
                setShowShopMenu((prev) => !prev);
              }}
            >
              <FontAwesomeIcon icon={faCoins} />
            </button>
            {showShopMenu && (
              <div className="nav-dropdown-menu">
                {campaigns.length === 0 ? (
                  <div className="nav-dropdown-empty">No campaigns</div>
                ) : (
                  campaigns.map((camp) => (
                    <button
                      key={camp.campaign_id}
                      className="nav-dropdown-item"
                      type="button"
                      onClick={() => {
                        setShowShopMenu(false);
                        navigate(`/campaign/${camp.campaign_id}/shop`);
                      }}
                    >
                      {camp.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="nav-dropdown" ref={playMenuRef}>
            <button
              className={`icon-btn nav-primary ${isActive('/game') ? 'active' : ''} ${showPlayMenu ? 'menu-open' : ''}`}
              aria-label="Play"
              title="Play"
              onClick={() => {
                if (singleCampaign) {
                  navigate(`/game?campaign_id=${singleCampaign.campaign_id}`);
                  return;
                }
                setShowPlayMenu((prev) => !prev);
              }}
            >
              <span className="nav-emoji" aria-hidden="true">⚔️</span>
            </button>
            {showPlayMenu && (
              <div className="nav-dropdown-menu">
                {campaigns.length === 0 ? (
                  <div className="nav-dropdown-empty">No campaigns</div>
                ) : (
                  campaigns.map((camp) => (
                    <button
                      key={camp.campaign_id}
                      className="nav-dropdown-item"
                      type="button"
                      onClick={() => {
                        setShowPlayMenu(false);
                        navigate(`/game?campaign_id=${camp.campaign_id}`);
                      }}
                    >
                      <span className="nav-dropdown-label">{camp.name}</span>
                      <span className={`nav-dropdown-status ${completionByCampaign[camp.campaign_id] ? 'done' : 'todo'}`}>
                        {completionByCampaign[camp.campaign_id] ? '✅' : '❌'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="nav-dropdown" ref={leaderboardMenuRef}>
            <button
              className={`icon-btn nav-primary ${isActive('/leaderboard') ? 'active' : ''} ${showLeaderboardMenu ? 'menu-open' : ''}`}
              aria-label="Leaderboard"
              title="Leaderboard"
              onClick={() => {
                if (singleCampaign) {
                  navigate(`/leaderboard/${singleCampaign.campaign_id}`);
                  return;
                }
                setShowLeaderboardMenu((prev) => !prev);
              }}
            >
              <FontAwesomeIcon icon={faTrophy} />
            </button>
            {showLeaderboardMenu && (
              <div className="nav-dropdown-menu">
                {campaigns.length === 0 ? (
                  <div className="nav-dropdown-empty">No campaigns</div>
                ) : (
                  campaigns.map((camp) => (
                    <button
                      key={camp.campaign_id}
                      className="nav-dropdown-item"
                      type="button"
                      onClick={() => {
                        setShowLeaderboardMenu(false);
                        navigate(`/leaderboard/${camp.campaign_id}`);
                      }}
                    >
                      {camp.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

        </div>

        <div className="nav-right">
          <div className="nav-dropdown" ref={userMenuRef}>
            <button
              className={`icon-btn ${isActive('/campaigns') || isActive('/account') || isActive('/updates') ? 'active' : ''} ${showUserMenu ? 'menu-open' : ''}`}
              aria-label="Menu"
              title="Menu"
              onClick={() => setShowUserMenu((prev) => !prev)}
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
            {showUserMenu && (
              <div className="nav-dropdown-menu">
                <button
                  className="nav-dropdown-item"
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/account');
                  }}
                >
                  <FontAwesomeIcon icon={faUserShield} /> Account
                </button>
                <button
                  className="nav-dropdown-item"
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/campaigns');
                  }}
                >
                  <FontAwesomeIcon icon={faLandmark} /> Campaigns
                </button>
                <button
                  className="nav-dropdown-item"
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/updates');
                  }}
                >
                  <FontAwesomeIcon icon={faList} /> Update Log
                </button>
                <button
                  className="nav-dropdown-item danger"
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                >
                  <FontAwesomeIcon icon={faRightFromBracket} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
