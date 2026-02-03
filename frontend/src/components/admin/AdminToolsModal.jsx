import React, { useEffect, useMemo, useState } from 'react';
import './AdminToolsModal.css';
import WeeklyRewardModal from '../rewards/WeeklyRewardModal';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function AdminToolsModal({
  isOpen,
  onClose,
  campaignId,
  token,
  isAdmin,
  isAdminCampaign,
  onSuccess
}) {
  const [adminEffects, setAdminEffects] = useState([]);
  const [adminEffectKey, setAdminEffectKey] = useState("");
  const [adminEffectPayload, setAdminEffectPayload] = useState("");
  const [adminClownRow, setAdminClownRow] = useState("");
  const [adminCoins, setAdminCoins] = useState("");
  const [adminStreak, setAdminStreak] = useState("");
  const [adminMessage, setAdminMessage] = useState(null);
  const [adminBusy, setAdminBusy] = useState(false);

  // Weekly reward preview (cosmetic only)
  const [showWeeklyPreview, setShowWeeklyPreview] = useState(false);
  const [weeklyPreviewCandidates, setWeeklyPreviewCandidates] = useState([]);
  const [weeklyPreviewRequired, setWeeklyPreviewRequired] = useState(0);
  const [weeklyPreviewSelected, setWeeklyPreviewSelected] = useState([]);
  const [weeklyPreviewError, setWeeklyPreviewError] = useState('');
  const [weeklyPreviewBusy, setWeeklyPreviewBusy] = useState(false);

  const sortedAdminEffects = useMemo(() => {
    return [...adminEffects].sort((a, b) => {
      const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""));
      if (categoryCompare !== 0) return categoryCompare;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [adminEffects]);

  useEffect(() => {
    if (!isOpen || !isAdmin || !token) return;
    const fetchEffects = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/effects`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setAdminEffects(data);
          if (!adminEffectKey && data[0]?.key) {
            setAdminEffectKey(data[0].key);
          }
        }
      } catch (err) {
        console.error("Failed to load admin effects:", err);
      }
    };
    fetchEffects();
  }, [isOpen, isAdmin, token, adminEffectKey]);

  if (!isOpen || !isAdmin || !isAdminCampaign) {
    return null;
  }

  const runAdminAction = async (endpoint, payload = {}) => {
    if (!campaignId || adminBusy) return null;
    setAdminBusy(true);
    setAdminMessage(null);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Admin action failed");
      }
      setAdminMessage("Action complete.");
      if (onSuccess) {
        onSuccess();
      }
      return data;
    } catch (err) {
      console.error(err);
      setAdminMessage(err?.message || "Admin action failed");
      return null;
    } finally {
      setAdminBusy(false);
    }
  };

  const handleAdminAddEffect = async () => {
    if (!adminEffectKey) {
      setAdminMessage("Select an effect first.");
      return;
    }
    const selected = adminEffects.find((effect) => effect.key === adminEffectKey);
    const payloadType = selected?.payload_type;
    if (payloadType) {
      const normalized = String(adminEffectPayload || "").trim().toLowerCase();
      if (payloadType === "letter" && (!normalized || normalized.length !== 1 || !/^[a-z]$/i.test(normalized))) {
        setAdminMessage("Choose a single letter first.");
        return;
      }
      if (payloadType === "word" && (!normalized || normalized.length !== 5 || !/^[a-z]{5}$/i.test(normalized))) {
        setAdminMessage("Choose a valid 5-letter word first.");
        return;
      }
    }
    let payload = selected?.payload_type
      ? { value: String(adminEffectPayload || "").trim().toLowerCase() }
      : null;
    if (selected?.key === "send_in_the_clown" && adminClownRow) {
      payload = payload || {};
      payload.row = adminClownRow;
    }
    const result = await runAdminAction("/api/admin/effects/add", {
      effect_key: adminEffectKey,
      effect_payload: payload
    });
    if (result) {
      setAdminEffectPayload("");
      setAdminClownRow("");
    }
  };

  const handleAdminClearEffects = async () => {
    await runAdminAction("/api/admin/effects/clear");
  };

  const handleAdminResetDay = async () => {
    await runAdminAction("/api/admin/reset_day");
  };

  const handleAdminAddCoins = async () => {
    const amount = parseInt(adminCoins, 10);
    if (Number.isNaN(amount)) {
      setAdminMessage("Enter a valid coin amount.");
      return;
    }
    const result = await runAdminAction("/api/admin/add_coins", { amount });
    if (result) {
      setAdminCoins("");
    }
  };

  const handleAdminAddStreak = async () => {
    const amount = parseInt(adminStreak, 10);
    if (Number.isNaN(amount)) {
      setAdminMessage("Enter a valid streak amount.");
      return;
    }
    const result = await runAdminAction("/api/admin/add_streak", { amount });
    if (result) {
      setAdminStreak("");
    }
  };

  const handleAdminResetDoubleDown = async () => {
    await runAdminAction("/api/admin/reset_double_down");
  };

  const toggleWeeklyPreviewRecipient = (userId) => {
    setWeeklyPreviewError('');
    setWeeklyPreviewSelected((prev) => {
      const exists = prev.includes(userId);
      if (exists) return prev.filter((id) => id !== userId);
      if (prev.length >= weeklyPreviewRequired) return prev;
      return [...prev, userId];
    });
  };

  const openWeeklyRewardPreview = async () => {
    if (!campaignId || weeklyPreviewBusy) return;
    setWeeklyPreviewBusy(true);
    setWeeklyPreviewError('');
    try {
      // Get current user id so we can exclude them from candidates.
      const meRes = await fetch(`${API_BASE}/api/user/info`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = await meRes.json();
      const myUserId = me?.user_id;

      const membersRes = await fetch(`${API_BASE}/api/campaign/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const membersData = await membersRes.json();
      const members = Array.isArray(membersData?.members) ? membersData.members : (Array.isArray(membersData) ? membersData : []);

      const total = members.length;
      const desired = Math.ceil(total / 3);
      const required = Math.min(desired, Math.max(total - 1, 0));

      const candidates = members
        .filter((m) => (myUserId ? m.user_id !== myUserId : true))
        .map((m) => ({
          user_id: m.user_id,
          display_name: m.display_name || `User ${m.user_id}`,
        }));

      setWeeklyPreviewRequired(required);
      setWeeklyPreviewCandidates(candidates);
      setWeeklyPreviewSelected([]);
      setShowWeeklyPreview(true);
    } catch (e) {
      setWeeklyPreviewError(e?.message || 'Could not load members for preview.');
      setShowWeeklyPreview(true);
    } finally {
      setWeeklyPreviewBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal admin-modal"
        onClick={(event) => event.stopPropagation()}
        role="presentation"
      >
        {showWeeklyPreview && (
          <WeeklyRewardModal
            visible={showWeeklyPreview}
            title="Weekly Reward"
            preview
            description={
              `Pick ${weeklyPreviewRequired} recipient${weeklyPreviewRequired === 1 ? '' : 's'}.`
            }
            candidates={weeklyPreviewCandidates}
            selectedIds={weeklyPreviewSelected}
            requiredCount={weeklyPreviewRequired}
            busy={weeklyPreviewBusy}
            error={weeklyPreviewError}
            confirmLabel="Close Preview"
            onToggle={toggleWeeklyPreviewRecipient}
            onConfirm={() => setShowWeeklyPreview(false)}
            onClose={() => setShowWeeklyPreview(false)}
          />
        )}
        <div className="admin-modal-header">
          <h2>Admin Tools</h2>
          <button
            className="admin-modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close admin tools"
          >
            ×
          </button>
        </div>
        <p className="admin-hint">Test effects and reset your state for today.</p>

        <div className="admin-section">
          <label className="admin-label" htmlFor="admin-effect-select">Add Effect</label>
          <div className="admin-row">
            <select
              id="admin-effect-select"
              className="admin-select"
              value={adminEffectKey}
              onChange={(event) => {
                setAdminEffectKey(event.target.value);
                setAdminEffectPayload("");
                setAdminClownRow("");
              }}
            >
              {sortedAdminEffects.map((effect) => (
                <option key={effect.key} value={effect.key}>
                  {effect.name} · {effect.category}{effect.affects_others ? " (target)" : " (status)"}
                </option>
              ))}
            </select>
            <button
              className="admin-action-btn"
              onClick={handleAdminAddEffect}
              disabled={adminBusy}
            >
              Apply
            </button>
          </div>
          {adminEffects.find((effect) => effect.key === adminEffectKey)?.payload_type && (
            <div className="admin-row">
              <input
                className="admin-input"
                type="text"
                value={adminEffectPayload}
                maxLength={adminEffects.find((effect) => effect.key === adminEffectKey)?.payload_type === "letter" ? 1 : 5}
                placeholder={
                  adminEffects.find((effect) => effect.key === adminEffectKey)?.payload_type === "letter"
                    ? "Enter a letter"
                    : "Enter a word"
                }
                onChange={(event) => setAdminEffectPayload(event.target.value)}
              />
            </div>
          )}
          {adminEffectKey === "send_in_the_clown" && (
            <div className="admin-row">
              <input
                className="admin-input"
                type="number"
                min="2"
                max="6"
                placeholder="Clown row (2-6)"
                value={adminClownRow}
                onChange={(event) => setAdminClownRow(event.target.value)}
              />
            </div>
          )}
          <button
            className="admin-action-btn secondary"
            onClick={handleAdminClearEffects}
            disabled={adminBusy}
          >
            Remove My Effects
          </button>
        </div>

        <div className="admin-section">
          <label className="admin-label">Reset Word</label>
          <button
            className="admin-action-btn danger"
            onClick={handleAdminResetDay}
            disabled={adminBusy}
          >
            Reset Today&apos;s Progress
          </button>
        </div>

        <div className="admin-section">
          <label className="admin-label" htmlFor="admin-coins-input">Adjust Coins</label>
          <div className="admin-row">
            <input
              id="admin-coins-input"
              className="admin-input"
              type="number"
              placeholder="e.g. 50"
              value={adminCoins}
              onChange={(event) => setAdminCoins(event.target.value)}
            />
            <button
              className="admin-action-btn"
              onClick={handleAdminAddCoins}
              disabled={adminBusy}
            >
              Add Coins
            </button>
          </div>
        </div>

        <div className="admin-section">
          <label className="admin-label" htmlFor="admin-streak-input">Adjust Streak</label>
          <div className="admin-row">
            <input
              id="admin-streak-input"
              className="admin-input"
              type="number"
              placeholder="e.g. 3"
              value={adminStreak}
              onChange={(event) => setAdminStreak(event.target.value)}
            />
            <button
              className="admin-action-btn"
              onClick={handleAdminAddStreak}
              disabled={adminBusy}
            >
              Add Streak
            </button>
          </div>
        </div>

        <div className="admin-section">
          <label className="admin-label">Double Down</label>
          <button
            className="admin-action-btn secondary"
            onClick={handleAdminResetDoubleDown}
            disabled={adminBusy}
          >
            Reset Double Down
          </button>
        </div>

        <div className="admin-section">
          <label className="admin-label">Weekly Reward (Preview)</label>
          <p className="admin-hint" style={{ marginTop: 6 }}>
            Cosmetic preview of the “winner picks recipients” modal. No backend changes.
          </p>
          <button
            className="admin-action-btn secondary"
            onClick={openWeeklyRewardPreview}
            disabled={adminBusy || weeklyPreviewBusy}
          >
            Preview Weekly Reward Picker
          </button>
        </div>

        {adminMessage && <div className="admin-message">{adminMessage}</div>}

        <div className="modal-buttons">
          <button className="troop-btn close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
