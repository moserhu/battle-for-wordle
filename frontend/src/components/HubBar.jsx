// frontend/src/components/HubBar.jsx
import React from 'react';
import '../styles/HubBar.css';

export default function HubBar({
  campaignDay,
  cutoffCountdown,
  midnightCountdown,
  isFinalDay,
  campaignEnded,
  campaignId,
  streak,
  coins,
  doubleDownUsed,
  doubleDownActivated,
}) {
  return (
    <section className="hub-bar">
      {/* Status Effects */}
      <div className="stat-card">
        <div className="stat-title">🧪 Status Effects</div>
        <div className="stat-value">Coming Soon</div>
        <div className="stat-subtle">Buffs & debuffs</div>
      </div>

      {/* Streak */}
      <div className="stat-card">
        <div className="stat-title">🔥 Streak</div>
        <div className="stat-value">{streak ?? 0} days</div>
      </div>

      {/* Coins */}
      <div className="stat-card">
        <div className="stat-title">💰 Coins</div>
        <div className="stat-value">{coins ?? 0}</div>
        <div className="stat-subtle">Economy coming soon</div>
      </div>

      {/* Completion */}
      <div className="stat-card">
        <div className="stat-title">Completion</div>
        {campaignEnded ? (
          <>
            <div className="completion-symbol complete">✅</div>
            <div className="completion-text complete">Complete</div>
          </>
        ) : (
          <>
            <div className="completion-symbol incomplete">❌</div>
            <div className="completion-text incomplete">Not Complete</div>
          </>
        )}
      </div>

      {/* Double Down */}
      <div className="stat-card">
        <div className="stat-title">⚔️ Double Down</div>
        {doubleDownUsed ? (
          <div className="stat-pill used">Used</div>
        ) : doubleDownActivated ? (
          <div className="stat-pill active">Active</div>
        ) : (
          <div className="stat-pill available">Available</div>
        )}
      </div>

      {/* Timer */}
      <div className="stat-card">
        <div className="stat-title">
          ⏳ {isFinalDay ? 'Ends In' : 'Next Word In'}
        </div>
        <div className="stat-value">
          {isFinalDay ? (
            <>
              {cutoffCountdown.hours}h {cutoffCountdown.minutes}m {cutoffCountdown.seconds}s
            </>
          ) : (
            <>
              {midnightCountdown.hours}h {midnightCountdown.minutes}m {midnightCountdown.seconds}s
            </>
          )}
        </div>
        {campaignEnded && (
          <div className="stat-subtle">
            Campaign ended — reset at midnight
          </div>
        )}
      </div>
    </section>
  );
}
