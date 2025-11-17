// frontend/src/pages/CampaignDashboard.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import HubBar from '../components/HubBar';
import ShareCard from '../components/ShareCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import '../styles/Dashboard.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

// --- countdown helpers, copied from GameScreen style ---
function getCountdownFrom(now, target) {
  const diffMs = Math.max(target - now, 0);
  return {
    hours: Math.floor(diffMs / (1000 * 60 * 60)),
    minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
  };
}

function getTimeUntilCutoffCT() {
  const now = new Date();
  const nowCT = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const cutoff = new Date(nowCT);
  cutoff.setHours(20, 0, 0, 0); // 8 PM CT
  return getCountdownFrom(nowCT, cutoff);
}

function getTimeUntilMidnightCT() {
  const now = new Date();
  const nowCT = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const midnight = new Date(nowCT);
  midnight.setHours(24, 0, 0, 0);
  return getCountdownFrom(nowCT, midnight);
}

export default function CampaignDashboard() {
  const { id: idFromRoute, campaignId } = useParams(); // support /campaign/:id or :campaignId
  const cid = campaignId || idFromRoute;
  const navigate = useNavigate();
  const { token, user, isAuthenticated, loading } = useAuth();

  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState('');

  // hub data
  const [campaignMeta, setCampaignMeta] = useState(null); // { name?, invite_code?, day, total }
  const [isFinalDay, setIsFinalDay] = useState(false);
  const [campaignEnded, setCampaignEnded] = useState(false);
  const [streak, setStreak] = useState(0);
  const [coins, setCoins] = useState(0); // placeholder
  const [doubleDownUsed, setDoubleDownUsed] = useState(false);
  const [doubleDownActivated, setDoubleDownActivated] = useState(false);

  // timers
  const [cutoffCountdown, setCutoffCountdown] = useState(getTimeUntilCutoffCT());
  const [midnightCountdown, setMidnightCountdown] = useState(getTimeUntilMidnightCT());

  // content
  const [recap, setRecap] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // ---- auth gate ----
  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  // ---- ticking timers (cutoff 8pm CT, midnight reset) ----
  useEffect(() => {
    const interval = setInterval(() => {
      setCutoffCountdown(getTimeUntilCutoffCT());
      setMidnightCountdown(getTimeUntilMidnightCT());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ---- load hub info + content ----
  useEffect(() => {
    if (!cid || !token || loading) return;

    const run = async () => {
      setLoadingPage(true);
      setError('');
      try {
        // campaign progress (day/total/name/invite)
        const progRes = await fetch(`${API_BASE}/api/campaign/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(cid) })
        });
        const prog = await progRes.json();
        setCampaignMeta(prog || null);
        setIsFinalDay(prog?.day >= prog?.total);

        // finished today?
        const endRes = await fetch(`${API_BASE}/api/campaign/finished_today`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(cid) })
        });
        const ended = await endRes.json();
        setCampaignEnded(Boolean(ended?.ended));

        // self member (double down, etc.)
        const selfRes = await fetch(`${API_BASE}/api/campaign/self_member`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(cid) })
        });
        const self = await selfRes.json();
        setDoubleDownActivated(self?.double_down_activated === 1 || self?.double_down_activated === true);
        setDoubleDownUsed(self?.double_down_used_week === 1 || self?.double_down_used_week === true);

        // streak (best-effort; ignore if missing)
        try {
          const st = await fetch(`${API_BASE}/api/campaign/streak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ campaign_id: Number(cid) })
          });
          if (st.ok) {
            const sj = await st.json();
            setStreak(Number(sj?.streak ?? 0));
          }
        } catch {}

        // coins/currency (placeholder endpoint)
        try {
          const cc = await fetch(`${API_BASE}/api/user/currency`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (cc.ok) {
            const cj = await cc.json();
            setCoins(Number(cj?.coins ?? 0));
          }
        } catch {}

        // recap (yesterday)
        let recapData = null;
        try {
          const r = await fetch(`${API_BASE}/api/campaign/${cid}/recap`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (r.ok) recapData = await r.json();
        } catch {}

        // leaderboard (today)
        let lbData = [];
        try {
          const l = await fetch(`${API_BASE}/api/leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ campaign_id: Number(cid) })
          }
        
        );
          if (l.ok) {
            const j = await l.json();
            lbData = Array.isArray(j.items) ? j.items : (Array.isArray(j) ? j : []);
          }
        } catch {}
        setRecap(recapData);
        setLeaderboard(lbData);
      } catch (e) {
        setError('Failed to load dashboard.');
      } finally {
        setLoadingPage(false);
      }
    };

    run();
  }, [cid, token, loading]);

  if (loading) return null;

  const inviteCode = campaignMeta?.invite_code || '';
  const campaignName = campaignMeta?.name || 'Campaign';

  return (
    <div className="dash-wrapper">
            {/* Back button above banner */}
      <div className="dash-back-row">
        <button
          className="btn back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      {/* TOP: Banner with title + actions */}
      <header className="dash-header">
        <div className="dash-header-inner">
          
          <h1 className="dash-title">
            {campaignMeta?.name || 'Campaign Dashboard'}
          </h1>

          <div className="dash-header-right">
            <button className="btn" onClick={() => navigate(`/game?campaign_id=${cid}`)}>
              Play
            </button>
            <button
              className="btn icon-btn"
              title="Invite Players"
              onClick={() => setShowInviteModal(true)}
            >
              <FontAwesomeIcon icon={faEnvelope} />
            </button>
            <button className="btn disabled" title="Coming soon" disabled>
              Store (Soon)
            </button>
          </div>
        </div>
      </header>

      {/* HUB BAR: Status Effects / Streak / Coins / Double Down / Timer */}
      <HubBar
        campaignId={cid}
        campaignDay={campaignMeta}
        cutoffCountdown={cutoffCountdown}
        midnightCountdown={midnightCountdown}
        isFinalDay={isFinalDay}
        campaignEnded={campaignEnded}
        doubleDownUsed={doubleDownUsed}
        doubleDownActivated={doubleDownActivated}
        streak={streak}
        coins={coins}
      />

      {error && <div className="card dash-error">{error}</div>}

      {loadingPage ? (
        <div className="card">Loading…</div>
      ) : (
        <section className="dash-grid">
          {/* Recap */}
          <div className="card">
            <h2>Yesterday’s Recap</h2>
            {recap?.date ? (
              <div className="recap-block">
                <p className="recap-date"><strong>{recap.date_label}</strong></p>
                {recap.summary && <p className="recap-summary">{recap.summary}</p>}
                {Array.isArray(recap.highlights) && recap.highlights.length > 0 ? (
                  <ul className="recap-list">
                    {recap.highlights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                ) : (
                  !recap.summary && <p>No recap available.</p>
                )}
              </div>
            ) : (
              <p>No recap available.</p>
            )}
          </div>

          {/* Leaderboard */}
          <div className="card">
            <h2>Today’s Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p>No scores yet.</p>
            ) : (
              <ol className="leaderboard-list">
                {leaderboard.map((p) => (
                  <li key={p.user_id || p.username} className="leaderboard-row">
                    <span className="lb-name" style={{ color: p.color || 'inherit' }}>
                      {p.display_name || p.username}
                    </span>
                    <span className="lb-score">{p.score} troops</span>
                  </li>
                ))}
              </ol>
            )}
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => navigate(`/leaderboard/${cid}`)}>
                The Pretty Leaderboard
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="card card--full">
            <h2>Tips</h2>
            <ul className="tips-list">
              <li>Check yesterday’s recap to plan your opening word.</li>
              <li>Use Double Down wisely—go aggressive if your lead is safe.</li>
              <li>Try starting with words with lots of vowels</li>
            </ul>
          </div>
        </section>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="invite-modal-overlay">
          <div className="invite-modal">
            <button
              className="invite-modal-close"
              onClick={() => setShowInviteModal(false)}
            >
              ×
            </button>
            <ShareCard
              campaignId={cid}
              campaignName={campaignName}
              inviteCode={inviteCode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
