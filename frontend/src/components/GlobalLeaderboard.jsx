import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import '../styles/GlobalLeaderboard.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function GlobalLeaderboard() {
  const { token, loading: authLoading } = useAuth();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setLoading(false);
      setError('You must be logged in to view the global leaderboard.');
      return;
    }

    const fetchGlobalLeaderboard = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard/global?limit=${limit}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to load leaderboard: ${res.status}`);
        }

        const data = await res.json();
        if (Array.isArray(data)) {
          setEntries(data);
        } else {
          setEntries([]);
        }
      } catch (err) {
        console.error('Error loading global leaderboard:', err);
        setError('Could not load global leaderboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalLeaderboard();
  }, [token, authLoading, limit]);

  if (loading) {
    return <p className="glb-status">Loading leaderboard…</p>;
  }

  if (error) {
    return <p className="glb-status glb-error">{error}</p>;
  }

  if (!entries.length) {
    return <p className="glb-status">No campaigns completed yet. Be the first to claim glory!</p>;
  }

  const formatDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <div className="glb-controls">
        <span className="glb-label">Show</span>
        {[10, 50, 100].map((value) => (
          <button
            key={value}
            type="button"
            className={`glb-toggle ${limit === value ? 'active' : ''}`}
            onClick={() => setLimit(value)}
          >
            Top {value}
          </button>
        ))}
      </div>
      <ol className="global-leaderboard">
        {entries.map((entry, index) => (
        <li key={`${entry.player_name}-${entry.ended_on}-${index}`} className="global-lb-row">
          <div className="glb-rank">
            {index === 0 ? '👑' : `#${index + 1}`}
          </div>
          <div className="glb-main">
            <div className="glb-name">{entry.player_name}</div>
            <div className="glb-sub">
              <span className="glb-campaign">{entry.campaign_name}</span>
            </div>
            {entry.ended_on && (
              <div className="glb-sub glb-date">{formatDate(entry.ended_on)}</div>
            )}
          </div>
          <div className="glb-score">
            {entry.best_troops} <span className="glb-score-label">troops</span>
          </div>
        </li>
        ))}
      </ol>
    </>
  );
}
