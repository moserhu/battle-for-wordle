import React from 'react';
import '../../styles/rewards/WeeklyRewardModal.css';

export default function WeeklyRewardModal({
  visible,
  title = 'Weekly Reward',
  description,
  candidates = [],
  selectedIds = [],
  requiredCount = 0,
  busy = false,
  error = '',
  confirmLabel = 'Confirm Picks',
  onToggle,
  onConfirm,
  footerNote,
  preview = false,
  onClose,
}) {
  if (!visible) return null;

  const canConfirm = selectedIds.length === requiredCount && requiredCount > 0 && !busy;

  return (
    <div className="weekly-reward-overlay" onClick={onClose || undefined} role="presentation">
      <div className="weekly-reward-modal" onClick={(e) => e.stopPropagation()} role="presentation">
        <div className="weekly-reward-header">
          <h2 className="weekly-reward-title">
            {title}{preview ? ' (Preview)' : ''}
          </h2>
          {onClose && (
            <button
              className="weekly-reward-close"
              type="button"
              onClick={onClose}
              aria-label="Close"
              disabled={busy}
            >
              ×
            </button>
          )}
        </div>

        {preview && (
          <p className="weekly-reward-subtle">
            Preview only — this does not grant items and does not block gameplay.
          </p>
        )}

        {description && <p className="weekly-reward-desc">{description}</p>}

        {error && <div className="weekly-reward-error">{error}</div>}

        <div className="weekly-reward-list" role="list">
          {candidates.map((c) => (
            <label key={c.user_id} className="weekly-reward-item">
              <input
                type="checkbox"
                checked={selectedIds.includes(c.user_id)}
                onChange={() => onToggle && onToggle(c.user_id)}
                disabled={busy}
              />
              <span className="weekly-reward-name">{c.display_name}</span>
            </label>
          ))}
          {!candidates.length && (
            <div className="weekly-reward-empty">
              No eligible candidates found.
            </div>
          )}
        </div>

        <div className="weekly-reward-actions">
          <button
            className="troop-btn"
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
          {onClose && (
            <button
              className="troop-btn close-btn"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              Close
            </button>
          )}
        </div>

        {footerNote && <p className="weekly-reward-footer">{footerNote}</p>}
      </div>
    </div>
  );
}
