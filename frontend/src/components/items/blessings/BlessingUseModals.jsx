import React from 'react';
import candleOfMercyIcon from '../../../assets/items/blessings/candle_of_mercy.png';
import './BlessingUseModals.css';

export default function BlessingUseModals({
  showCostModal = false,
  showCandleModal = false,
  showDispelConfirmModal = false,
  pendingItemName = '',
  hasCandleInventory = false,
  onCloseCost,
  onSacrifice,
  onUseCandle,
  onCandleYes,
  onCandleNo,
  onDispelConfirm,
  onDispelCancel,
}) {
  return (
    <>
      {showCostModal && pendingItemName && (
        <div className="blessing-use-overlay">
          <div className="modal blessing-confirm-modal">
            <div className="curse-info-header">
              <h2 className="blessing-title">Blessing Sacrifice</h2>
              <button
                className="self-items-close"
                type="button"
                onClick={onCloseCost}
                aria-label="Close blessing confirmation"
              >
                ✕
              </button>
            </div>
            <div className="blessing-confirm-body">
              <p>Using <strong>{pendingItemName}</strong> costs <strong>5 troops</strong>.</p>
            </div>
            <div className="blessing-confirm-actions">
              {hasCandleInventory && (
                <button className="troop-btn blessing-candle-btn" type="button" onClick={onUseCandle}>
                  <span aria-hidden="true">🕯️</span>
                  Use Candle of Mercy
                </button>
              )}
              <button className="troop-btn blessing-sacrifice-btn" type="button" onClick={onSacrifice}>
                Sacrifice (-5 troops)
              </button>
              <button className="troop-btn close-btn" type="button" onClick={onCloseCost}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCandleModal && pendingItemName && (
        <div className="blessing-use-overlay">
          <div className="modal blessing-confirm-modal">
            <div className="curse-info-header">
              <h2 className="blessing-title">Candle of Mercy</h2>
              <button
                className="self-items-close"
                type="button"
                onClick={onCandleNo}
                aria-label="Close candle confirmation"
              >
                ✕
              </button>
            </div>
            <img src={candleOfMercyIcon} alt="Candle of Mercy" className="blessing-confirm-item-art" />
            <div className="blessing-confirm-body">
              <p>Use Candle of Mercy to avoid losing <strong>5 troops</strong> for this blessing?</p>
              <p>If yes, the candle and <strong>{pendingItemName}</strong> will both be consumed.</p>
            </div>
            <div className="blessing-confirm-actions">
              <button className="troop-btn" type="button" onClick={onCandleYes}>
                Yes
              </button>
              <button className="troop-btn close-btn" type="button" onClick={onCandleNo}>
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {showDispelConfirmModal && pendingItemName && (
        <div className="blessing-use-overlay">
          <div className="modal blessing-confirm-modal">
            <div className="curse-info-header">
              <h2 className="blessing-title">Dispel Curse</h2>
              <button
                className="self-items-close"
                type="button"
                onClick={onDispelCancel}
                aria-label="Close dispel curse confirmation"
              >
                ✕
              </button>
            </div>
            <div className="blessing-confirm-body">
              <p>Use <strong>{pendingItemName}</strong>?</p>
              <p>This will <strong>not</strong> remove today&apos;s curse effect.</p>
              <p>It only removes the cursed lock so you can use blessings.</p>
            </div>
            <div className="blessing-confirm-actions">
              <button className="troop-btn blessing-sacrifice-btn" type="button" onClick={onDispelConfirm}>
                Yes, use Dispel Curse
              </button>
              <button className="troop-btn close-btn" type="button" onClick={onDispelCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
