// frontend/src/components/NavBar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faLandmark, faUserShield, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import '../styles/NavBar.css';
import { useAuth } from '../auth/AuthProvider';  // ⬅️ add this

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();                  // ⬅️ pull from context

  const isActive = (pattern) => {
    if (pattern instanceof RegExp) return pattern.test(location.pathname);
    return location.pathname.startsWith(pattern);
  };

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

  return (
    <nav className="nav-bar">
      <div className="nav-inner">
        <button
          className="brand"
          aria-label="Home"
          title="Home"
          onClick={() => navigate('/home')}
        >
          B4W
        </button>

        <div className="nav-icons">
          <button
            className={`icon-btn ${isActive('/home') ? 'active' : ''}`}
            aria-label="Home"
            title="Home"
            onClick={() => navigate('/home')}
          >
            <FontAwesomeIcon icon={faHouse} />
          </button>

          <button
            className={`icon-btn ${isActive('/campaigns') ? 'active' : ''}`}
            aria-label="Campaigns"
            title="Campaigns"
            onClick={() => navigate('/campaigns')}
          >
            <FontAwesomeIcon icon={faLandmark} />
          </button>

          <button
            className={`icon-btn ${isActive('/account') ? 'active' : ''}`}
            aria-label="Account"
            title="Account"
            onClick={() => navigate('/account')}
          >
            <FontAwesomeIcon icon={faUserShield} />
          </button>

          <button
            className="icon-btn"
            aria-label="Logout"
            title="Logout"
            onClick={handleLogout}
          >
            <FontAwesomeIcon icon={faRightFromBracket} />
          </button>
        </div>
      </div>
    </nav>
  );
}
