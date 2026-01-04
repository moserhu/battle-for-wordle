import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import '../styles/GlobalLeaderboard.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function GlobalLeaderboard() {
  const { token, loading: authLoading } = useAuth();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setLoading(false);
      setError('You must be logged in to view the global leaderboard.');
      return;
    }

    const fetchGlobalLeaderboard = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard/global`, {
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
  }, [token, authLoading]);

  if (loading) {
    return <p className="glb-status">Loading leaderboard…</p>;
  }

  if (error) {
    return <p className="glb-status glb-error">{error}</p>;
  }

  if (!entries.length) {
    return <p className="glb-status">No campaigns completed yet. Be the first to claim glory!</p>;
  }

  return (
    <ol className="global-leaderboard">
      {entries.slice(0, 10).map((entry, index) => (
        <li key={`${entry.player_name}-${entry.ended_on}-${index}`} className="global-lb-row">
          <div className="glb-rank">
            {index === 0 ? '👑' : `#${index + 1}`}
          </div>
          <div className="glb-main">
            <div className="glb-name">{entry.player_name}</div>
            <div className="glb-sub">
              Best season: <span className="glb-campaign">{entry.campaign_name}</span>
              {entry.ended_on && (
                <>
                  {' '}— <span className="glb-date">ended {entry.ended_on}</span>
                </>
              )}
            </div>
          </div>
          <div className="glb-score">
            {entry.best_troops} <span className="glb-score-label">troops</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
