// frontend/src/components/HubBar.jsx
import React, { useState } from 'react';
import '../styles/HubBar.css';
import DoubleDownModal from './DoubleDownModal';
import CoinsInfoModal from './CoinsInfoModal';

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
  const [showDoubleDownInfo, setShowDoubleDownInfo] = useState(false);
  const [showCoinsInfo, setShowCoinsInfo] = useState(false);

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
      <div className="stat-card coins-card">
        <div className="stat-title">💰 Coins</div>
        <div className="stat-value">{coins ?? 0}</div>
        <button
          className="dd-info-btn"
          type="button"
          aria-label="Coins info"
          onClick={() => setShowCoinsInfo(true)}
        >
          i
        </button>
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
      <div className="stat-card double-down-card">
        <div className="stat-title">⚔️ Double Down</div>
        {doubleDownUsed ? (
          <div className="stat-pill used">Used</div>
        ) : doubleDownActivated ? (
          <div className="stat-pill active">Active</div>
        ) : (
          <div className="stat-pill available">Available</div>
        )}
        <button
          className="dd-info-btn"
          type="button"
          aria-label="Double Down info"
          onClick={() => setShowDoubleDownInfo(true)}
        >
          i
        </button>
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
            Completed for today — reset at midnight
          </div>
        )}
      </div>

      <DoubleDownModal
        visible={showDoubleDownInfo}
        onAccept={() => {}}
        onDecline={() => setShowDoubleDownInfo(false)}
        showActions={false}
      />
      <CoinsInfoModal
        visible={showCoinsInfo}
        onClose={() => setShowCoinsInfo(false)}
      />
    </section>
  );
}
