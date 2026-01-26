// frontend/src/pages/CampaignDashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import HubBar from '../components/HubBar';
import RulerTitleModal from '../components/RulerTitleModal';
import ProfileModal from '../components/ProfileModal';
import StreakInfoModal from '../components/StreakInfoModal';
import AccoladesModal from '../components/AccoladesModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMedal } from '@fortawesome/free-solid-svg-icons';
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
  cutoff.setHours(24, 0, 0, 0); // midnight CT
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
  const [selfMember, setSelfMember] = useState(null);

  // timers
  const [cutoffCountdown, setCutoffCountdown] = useState(getTimeUntilCutoffCT());
  const [midnightCountdown, setMidnightCountdown] = useState(getTimeUntilMidnightCT());

  // content
  const [recap, setRecap] = useState(null);
  const [recapDay, setRecapDay] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // invite modal
  const [showRulerModal, setShowRulerModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showStreakInfo, setShowStreakInfo] = useState(false);
  const [previewPlayer, setPreviewPlayer] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [showAccoladesModal, setShowAccoladesModal] = useState(false);
  const [accolades, setAccolades] = useState([]);

  // ---- auth gate ----
  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  // ---- ticking timers (midnight CT reset) ----
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

        // self member (double down, etc.)
        const selfRes = await fetch(`${API_BASE}/api/campaign/self_member`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(cid) })
        });
        const self = await selfRes.json();
        setSelfMember(self);
        setDoubleDownActivated(self?.double_down_activated === 1 || self?.double_down_activated === true);
        setDoubleDownUsed(self?.double_down_used_week === 1 || self?.double_down_used_week === true);

        const accoladeRes = await fetch(`${API_BASE}/api/campaign/accolades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(cid) })
        });
        const accoladeJson = await accoladeRes.json();
        setAccolades(accoladeJson?.accolades || []);
        setCampaignEnded(self?.daily_completed === 1 || self?.daily_completed === true);

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

        // coins/currency (campaign-specific)
        try {
          const cc = await fetch(`${API_BASE}/api/campaign/coins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ campaign_id: Number(cid) })
          });
          if (cc.ok) {
            const cj = await cc.json();
            setCoins(Number(cj?.coins ?? 0));
          }
        } catch {}

        const targetRecapDay = Math.max(1, prog?.day || 1);
        setRecapDay(targetRecapDay);

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
            console.log('[CampaignDashboard] leaderboard', lbData);
          }
        } catch {}
        setLeaderboard(lbData);
      } catch (e) {
        setError('Failed to load dashboard.');
      } finally {
        setLoadingPage(false);
      }
    };

    run();
  }, [cid, token, loading]);

  useEffect(() => {
    if (!cid || !token || !recapDay) {
      setRecap(null);
      return;
    }
    let cancelled = false;
    const loadRecap = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/campaign/${cid}/recap?day=${recapDay}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!cancelled && r.ok) {
          const recapData = await r.json();
          setRecap(recapData);
        }
      } catch {}
    };
    loadRecap();
    return () => {
      cancelled = true;
    };
  }, [cid, token, recapDay]);

  const maxRecapDay = useMemo(() => {
    if (campaignMeta?.day) {
      return Math.max(1, campaignMeta.day);
    }
    return 1;
  }, [campaignMeta?.day]);

  if (loading) return null;

  const rulerTitle = campaignMeta?.ruler_title || 'Current Ruler';
  const isRuler = campaignMeta?.ruler_id && user?.user_id === campaignMeta.ruler_id;
  const isAdminCampaign = Boolean(campaignMeta?.is_admin_campaign);
  const displayName = selfMember?.display_name || user?.first_name || 'Player';
  const profileImageUrl = selfMember?.profile_image_url || '';
  const armyName = selfMember?.army_name || '';

  const handleEditRulerTitle = () => {
    setShowRulerModal(true);
  };

  const handleSaveRulerTitle = async (nextTitle) => {
    try {
      const res = await fetch(`${API_BASE}/api/campaign/ruler_title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: Number(cid), title: nextTitle })
      });
      if (res.ok) {
        const data = await res.json();
        setCampaignMeta((prev) => prev ? { ...prev, ruler_title: data.ruler_title } : prev);
        setShowRulerModal(false);
      }
    } catch {}
  };

  return (
    <div className={`dash-wrapper${isAdminCampaign ? " admin-theme" : ""}`}>
      {/* TOP: Banner with title + actions */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-header-center-wrap">
            <div className="dash-header-center compact">
              <div className="dash-title-card">
                <div className="dash-title-eyebrow">Kingdom of</div>
                <h1 className="dash-title">
                  {campaignMeta?.name || 'Campaign Dashboard'}
                </h1>
                <button
                  className="dash-accolades-btn"
                  type="button"
                  onClick={() => setShowAccoladesModal(true)}
                  aria-label="Open accolades"
                  title="Accolades"
                >
                  <FontAwesomeIcon icon={faMedal} />
                </button>
              </div>
              <div className="dash-herald-card">
                <button
                  className="dash-profile-inline"
                  onClick={() => setShowProfileModal(true)}
                  type="button"
                >
                  <div className="dash-profile-image">
                    {profileImageUrl ? <img src={profileImageUrl} alt="" /> : <span>?</span>}
                  </div>
                  <span className="dash-profile-label">Profile</span>
                </button>
                <div className="dash-herald-content">
                  <div className="dash-herald-body">
                    <div className="dash-herald-label">Hear ye</div>
                    <div className="dash-herald-name">{displayName || 'Unknown Hero'}</div>
                    <div className="dash-herald-army">
                      {armyName ? `Commander of ${armyName}` : 'Commander of a wandering host'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="dash-hub-wrap">
        <HubBar
          campaignEnded={campaignEnded}
          doubleDownUsed={doubleDownUsed}
          doubleDownActivated={doubleDownActivated}
          coins={coins}
          onBattle={() => navigate(`/game?campaign_id=${cid}`)}
          onInventory={() => navigate(`/campaign/${cid}/items`)}
          onShop={() => navigate(`/campaign/${cid}/shop`)}
          streak={streak}
          cutoffCountdown={cutoffCountdown}
          midnightCountdown={midnightCountdown}
          isFinalDay={isFinalDay}
          onStreakInfo={() => setShowStreakInfo(true)}
        />
      </div>

      <section className="dash-king-banner" aria-live="polite">
        <div className="dash-king-text">
          <div className="dash-king-title">{rulerTitle}</div>
          <div className="dash-king-name">{campaignMeta?.king || 'Uncrowned'}</div>
        </div>
        <div className="dash-king-glow" aria-hidden="true" />
        {isRuler && (
          <button className="dash-king-edit" onClick={handleEditRulerTitle} type="button">
            Edit
          </button>
        )}
      </section>
      <RulerTitleModal
        visible={showRulerModal}
        initialTitle={rulerTitle}
        onSave={handleSaveRulerTitle}
        onClose={() => setShowRulerModal(false)}
      />
      <AccoladesModal
        open={showAccoladesModal}
        onClose={() => setShowAccoladesModal(false)}
        accolades={accolades}
        isAdminCampaign={isAdminCampaign}
      />

      <section className="dash-surface">
        <div className="dash-surface-header">
          <div className="dash-surface-title">Campaign Overview</div>
          <div className="dash-surface-subtitle">
            {campaignMeta?.day ? `Day ${campaignMeta.day} of ${campaignMeta?.total ?? '?'}` : 'Loading…'}
          </div>
        </div>

        {error && <div className="dash-panel dash-error">{error}</div>}

        {loadingPage ? (
          <div className="dash-panel">Loading…</div>
        ) : (
          <section className="dash-panels">
            {/* Recap */}
            <div className="dash-panel">
              <div className="dash-panel-header">
                <h2>Battle Log</h2>
                {recapDay ? (
                  <div className="recap-controls">
                    <button
                      className="recap-nav"
                      type="button"
                      onClick={() => setRecapDay((prev) => (prev > 1 ? prev - 1 : prev))}
                      disabled={recapDay <= 1}
                    >
                      ‹
                    </button>
                    <span className="recap-day">Day {recapDay}</span>
                    <button
                      className="recap-nav"
                      type="button"
                      onClick={() =>
                        setRecapDay((prev) =>
                          prev < maxRecapDay ? prev + 1 : prev
                        )
                      }
                      disabled={recapDay >= maxRecapDay}
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </div>
              {recap?.date ? (
                <div className="recap-block">
                  <p className="recap-date"><strong>{recap.date_label}</strong></p>
                  {recap.summary && <p className="recap-summary">{recap.summary}</p>}
                  {Array.isArray(recap.events) && recap.events.length > 0 ? (
                    <div className="recap-events">
                      {recap.events.map((evt, i) => (
                        <div className="recap-event" key={i}>
                          <div className="recap-avatar">
                            {evt.profile_image_url ? (
                              <img src={evt.profile_image_url} alt="" />
                            ) : (
                              <span>?</span>
                            )}
                          </div>
                          <div className="recap-event-body">
                            {evt.name ? <div className="recap-event-name">{evt.name}</div> : null}
                            <div className="recap-event-text">{evt.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : Array.isArray(recap.highlights) && recap.highlights.length > 0 ? (
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
            <div className="dash-panel">
              <div className="dash-panel-header">
                <h2>Leaderboard</h2>
              </div>
              {leaderboard.length === 0 ? (
                <p>No scores yet.</p>
              ) : (
                <ol className="leaderboard-list">
                  {leaderboard.map((p) => (
                    <li key={p.user_id || p.username} className="leaderboard-row">
                      <div
                        className="lb-player"
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewPlayer(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setPreviewPlayer(p);
                          }
                        }}
                      >
                        <div className="lb-avatar">
                          {p.profile_image_url ? (
                            <img src={p.profile_image_url} alt="" />
                          ) : (
                            <span>?</span>
                          )}
                        </div>
                        <span className="lb-name" style={{ color: p.color || 'inherit' }}>
                          {p.display_name || p.username}
                        </span>
                      </div>
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

          </section>
        )}
      </section>

      {showProfileModal && (
        <ProfileModal
          visible={showProfileModal}
          token={token}
          campaignId={cid}
          displayName={displayName}
          color={selfMember?.color || '#ffffff'}
          profileImageUrl={profileImageUrl}
          armyImageUrl={selfMember?.army_image_url || ''}
          armyName={armyName}
          onClose={() => setShowProfileModal(false)}
          onUpdated={(updates) => {
            setSelfMember((prev) => ({
              ...(prev || {}),
              ...(updates.profileImageUrl ? { profile_image_url: updates.profileImageUrl } : null),
              ...(updates.armyImageUrl ? { army_image_url: updates.armyImageUrl } : null),
              ...(updates.armyName ? { army_name: updates.armyName } : null),
              ...(updates.displayName ? { display_name: updates.displayName } : null),
              ...(updates.color ? { color: updates.color } : null),
            }));
            if (user?.user_id) {
              setLeaderboard((prev) =>
                prev.map((entry) =>
                  entry.user_id === user.user_id
                    ? {
                        ...entry,
                        ...(updates.profileImageUrl ? { profile_image_url: updates.profileImageUrl } : null),
                        ...(updates.armyImageUrl ? { army_image_url: updates.armyImageUrl } : null),
                        ...(updates.armyName ? { army_name: updates.armyName } : null),
                        ...(updates.displayName ? { display_name: updates.displayName } : null),
                        ...(updates.color ? { color: updates.color } : null),
                      }
                    : entry
                )
              );
            }
          }}
        />
      )}
      <StreakInfoModal
        visible={showStreakInfo}
        onClose={() => setShowStreakInfo(false)}
      />
      {previewPlayer && (
        <div className="dash-preview-overlay" onClick={() => setPreviewPlayer(null)}>
          <div
            className="dash-preview-card"
            style={{
              backgroundImage: previewPlayer.army_image_url
                ? `url(${previewPlayer.army_image_url})`
                : undefined,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (previewPlayer.army_image_url) {
                setPreviewImageUrl(previewPlayer.army_image_url);
              }
            }}
          >
            <button
              className="dash-preview-close"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewPlayer(null);
              }}
            >
              ×
            </button>
            <div className="dash-preview-avatar">
              {previewPlayer.profile_image_url ? (
                <img
                  src={previewPlayer.profile_image_url}
                  alt=""
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImageUrl(previewPlayer.profile_image_url);
                  }}
                />
              ) : (
                <span>?</span>
              )}
            </div>
            <div className="dash-preview-name">
              {previewPlayer.display_name || previewPlayer.username}
            </div>
            <div className="dash-preview-army-name">
              {previewPlayer.army_name || "Unnamed Army"}
            </div>
          </div>
        </div>
      )}
      {previewImageUrl && (
        <div className="dash-image-overlay" onClick={() => setPreviewImageUrl("")}>
          <div className="dash-image-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="dash-image-close"
              type="button"
              onClick={() => setPreviewImageUrl("")}
            >
              ×
            </button>
            <img src={previewImageUrl} alt="Player preview" />
          </div>
        </div>
      )}
    </div>
  );
}
