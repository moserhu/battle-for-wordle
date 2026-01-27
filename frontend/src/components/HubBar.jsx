// frontend/src/components/HubBar.jsx
import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoins } from '@fortawesome/free-solid-svg-icons';
import '../styles/HubBar.css';
import DoubleDownModal from './DoubleDownModal';
import CoinsInfoModal from './CoinsInfoModal';

export default function HubBar({
  cutoffCountdown,
  midnightCountdown,
  isFinalDay,
  campaignEnded,
  coins,
  doubleDownUsed,
  doubleDownActivated,
  onBattle,
  onInventory,
  onShop,
  streak,
  onStreakInfo,
}) {
  const [showDoubleDownInfo, setShowDoubleDownInfo] = useState(false);
  const [showCoinsInfo, setShowCoinsInfo] = useState(false);

  return (
    <section className="hub-bar hub-bar-split">
      <div className="hub-card hub-battle">
        <div className="hub-card-title">⚔️ Battle</div>
        <button className="hub-primary-btn" type="button" onClick={onBattle}>
          Enter Battlefield
        </button>
        <div className="hub-battle-meta">
          <div className="hub-battle-chip">
            <span className="hub-chip-label">{isFinalDay ? 'Ends In' : 'Next Word'}</span>
            <span className="hub-chip-value">
              {(() => {
                const countdown = isFinalDay ? cutoffCountdown : midnightCountdown;
                if (countdown.hours === 0 && countdown.minutes < 10) {
                  return `${countdown.minutes}m ${countdown.seconds}s`;
                }
                return `${countdown.hours}h ${countdown.minutes}m`;
              })()}
            </span>
          </div>
          <button className="hub-battle-chip hub-battle-chip--streak" type="button" onClick={onStreakInfo}>
            <span className="hub-chip-label">Streak</span>
            <span className="hub-chip-value">
              {streak ?? 0}
              {streak >= 1 ? ' 🔥' : ''}
            </span>
          </button>
        </div>
        <div className="hub-battle-badges">
          <div className={`hub-status ${campaignEnded ? 'complete' : 'incomplete'}`}>
            {campaignEnded ? '✅ Complete' : '❌ Not Complete'}
          </div>
          <button
            className="hub-status hub-status-dd"
            type="button"
            onClick={() => setShowDoubleDownInfo(true)}
          >
            ⚔️ {doubleDownUsed ? 'Used' : doubleDownActivated ? 'Active' : 'Available'}
          </button>
        </div>
      </div>

      <div className="hub-card hub-economy">
        <div className="hub-card-title">💰 Economy</div>
        <div className="hub-coins-value">
          {coins ?? 0}
          <span className="hub-coins-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faCoins} />
          </span>
        </div>
        <div className="hub-econ-actions">
          <button className="btn hub-econ-btn" type="button" onClick={onInventory}>
            Inventory
          </button>
          <button className="btn btn-shop hub-econ-btn" type="button" onClick={onShop}>
            Shop
          </button>
        </div>
        <button
          className="dd-info-btn hub-coins-info"
          type="button"
          aria-label="Coins info"
          onClick={() => setShowCoinsInfo(true)}
        >
          i
        </button>
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
