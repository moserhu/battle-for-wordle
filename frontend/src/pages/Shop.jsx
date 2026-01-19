// frontend/src/pages/Shop.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/Shop.css';
import oracleWhisperSprite from '../assets/items/oracles_whisper.png';
import cartographersInsightSprite from '../assets/items/cartographers_insight.png';
import candleOfMercySprite from '../assets/items/candle_of_mercy.png';
import bloodOathInkSprite from '../assets/items/blood_oath_ink.png';
import spiderSwarmSprite from '../assets/items/spider_swarm.png';
import danceOfTheJesterSprite from '../assets/items/dance_of_the_jester.png';
import coneOfColdSprite from '../assets/items/cone_of_cold.png';
import sealOfSilenceSprite from '../assets/items/seal_of_silence.png';
import voidbrandSprite from '../assets/items/voidbrand.png';
import edictOfCompulsionSprite from '../assets/items/edict_of_compulsion.png';
import executionersCutSprite from '../assets/items/executioners_cut.png';
import sendInTheClownSprite from '../assets/items/clown.png';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function Shop() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { token, user, isAuthenticated, loading } = useAuth();

  const [campaignName, setCampaignName] = useState('Campaign Shop');
  const [coins, setCoins] = useState(0);
  const [items, setItems] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState('');
  const [purchaseBusy, setPurchaseBusy] = useState('');
  const [reshuffleBusy, setReshuffleBusy] = useState(false);
  const [purchasedToday, setPurchasedToday] = useState(false);
  const [purchasedItemKeys, setPurchasedItemKeys] = useState([]);
  const [canReshuffle, setCanReshuffle] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isAdminCampaign, setIsAdminCampaign] = useState(false);
  const spriteByKey = {
    oracle_whisper: oracleWhisperSprite,
    cartographers_insight: cartographersInsightSprite,
    candle_of_mercy: candleOfMercySprite,
    blood_oath_ink: bloodOathInkSprite,
    spider_swarm: spiderSwarmSprite,
    dance_of_the_jester: danceOfTheJesterSprite,
    cone_of_cold: coneOfColdSprite,
    seal_of_silence: sealOfSilenceSprite,
    voidbrand: voidbrandSprite,
    edict_of_compulsion: edictOfCompulsionSprite,
    executioners_cut: executionersCutSprite,
    send_in_the_clown: sendInTheClownSprite,
  };

  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  const loadShopState = useCallback(async () => {
    if (!campaignId || !token) return;
    setLoadingPage(true);
    setError('');

    try {
      const [stateRes, progressRes] = await Promise.all([
        fetch(`${API_BASE}/api/campaign/shop/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(campaignId) })
        }),
        fetch(`${API_BASE}/api/campaign/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(campaignId) })
        })
      ]);

      if (progressRes.ok) {
        const progress = await progressRes.json();
        if (progress?.name) setCampaignName(progress.name);
        setIsAdminCampaign(Boolean(progress?.is_admin_campaign));
      }

      if (!stateRes.ok) {
        const err = await stateRes.json();
        throw new Error(err?.detail || 'Failed to load shop');
      }

      const state = await stateRes.json();
      setCoins(Number(state?.coins ?? 0));
      setItems(Array.isArray(state?.items) ? state.items : []);
      setPurchasedToday(Boolean(state?.purchased_today));
      setPurchasedItemKeys(Array.isArray(state?.purchased_item_keys) ? state.purchased_item_keys : []);
      setCanReshuffle(Boolean(state?.can_reshuffle));
    } catch (err) {
      setError(err?.message || 'Failed to load shop.');
    } finally {
      setLoadingPage(false);
    }
  }, [campaignId, token]);

  useEffect(() => {
    if (!loading && token && campaignId) {
      loadShopState();
    }
  }, [loading, token, campaignId, loadShopState]);

  const handlePurchase = async (itemKey) => {
    if (purchaseBusy) return;
    setPurchaseBusy(itemKey);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/campaign/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: Number(campaignId), item_key: itemKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Purchase failed');
      }
      setCoins(Number(data?.coins ?? coins));
      await loadShopState();
    } catch (err) {
      setError(err?.message || 'Purchase failed.');
    } finally {
      setPurchaseBusy('');
    }
  };

  const handleReshuffle = async () => {
    if (reshuffleBusy || !canReshuffle) return;
    setReshuffleBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/campaign/shop/reshuffle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: Number(campaignId) })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Reshuffle failed');
      }
      setCoins(Number(data?.coins ?? coins));
      setItems(Array.isArray(data?.items) ? data.items : []);
      await loadShopState();
    } catch (err) {
      setError(err?.message || 'Reshuffle failed.');
    } finally {
      setReshuffleBusy(false);
    }
  };

  if (loading) return null;

  return (
    <div className={`shop-wrapper${isAdminCampaign ? " admin-theme" : ""}`}>
      <header className="shop-header">
        <div className="shop-header-inner">
          <div className="shop-title-group">
            <h1 className="shop-title">{campaignName} Shop</h1>
            <p className="shop-subtitle">Spend your coins on buffs, tricks, and tactics.</p>
          </div>
          <div className="shop-header-actions">
            <div className="shop-coins">
              <span className="shop-coins-label">Coins</span>
              <span className="shop-coins-value">{coins}</span>
            </div>
            <button
              className={`btn ${(!canReshuffle || coins < 3) ? 'disabled' : ''}`}
              onClick={handleReshuffle}
              disabled={reshuffleBusy || !canReshuffle || coins < 3}
            >
              {reshuffleBusy ? (
                'Reshuffling...'
              ) : (
                <span className="shop-reshuffle-label">
                  <span>Reshuffle</span>
                  <span className="shop-reshuffle-cost">3 coins</span>
                </span>
              )}
            </button>
            <button className="btn" onClick={() => navigate(`/campaign/${campaignId}/items`)}>
              Item Storage
            </button>
            <button className="btn" onClick={() => navigate(`/campaign/${campaignId}`)}>
              Back to Camp
            </button>
          </div>
        </div>
      </header>

      <section className="shop-surface">
        {error && <div className="shop-panel shop-error">{error}</div>}
        {loadingPage ? (
          <div className="shop-panel">Loading shop...</div>
        ) : (
          <div className="shop-grid">
            <div className="shop-panel">
              <div className="shop-panel-header">
                <h2>Catalog</h2>
              </div>
              <div className="shop-items">
                {items.length === 0 ? (
                  <div className="shop-empty">No items available yet.</div>
                ) : (
                  items.map((item) => {
                    const affordable = coins >= item.cost;
                    const purchased = purchasedItemKeys.includes(item.key);
                    return (
                      <div className={`shop-item-card${purchased ? " purchased" : ""}`} key={item.key}>
                        <div className="shop-item-body">
                          <div className="shop-item-title">{item.name}</div>
                          <div className={`shop-item-sprite${spriteByKey[item.key] ? " has-image" : ""}`}>
                            {spriteByKey[item.key] ? (
                              <img
                                src={spriteByKey[item.key]}
                                alt={item.name}
                                className="shop-item-sprite-img"
                              />
                            ) : (
                              <span>Sprite</span>
                            )}
                          </div>
                          <div className="shop-item-footer">
                            <span className="shop-item-cost">{item.cost} coins</span>
                          </div>
                        </div>
                        <button
                          className="btn"
                          onClick={() => setSelectedItem(item)}
                        >
                          {purchased ? 'View' : 'View'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}
      </section>
      {selectedItem && (
        <div className="shop-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="shop-modal" onClick={(event) => event.stopPropagation()}>
            <div className="shop-modal-header">
              <h3>{selectedItem.name}</h3>
              <button className="shop-modal-close" onClick={() => setSelectedItem(null)} type="button">
                ×
              </button>
            </div>
            <div className="shop-modal-body">
              <div className="shop-modal-image">
                {spriteByKey[selectedItem.key] && (
                  <img
                    src={spriteByKey[selectedItem.key]}
                    alt={selectedItem.name}
                    className="shop-modal-image-img"
                  />
                )}
              </div>
              <div className="shop-modal-text">
                <p className="shop-modal-description">{selectedItem.description}</p>
              </div>
            </div>
            <div className="shop-modal-actions">
              <div className="shop-modal-cost">{selectedItem.cost} coins</div>
              <button
                className={`btn ${coins < selectedItem.cost || purchasedItemKeys.includes(selectedItem.key) ? 'disabled' : ''}`}
                disabled={coins < selectedItem.cost || purchasedItemKeys.includes(selectedItem.key) || purchaseBusy === selectedItem.key}
                onClick={() => handlePurchase(selectedItem.key)}
                type="button"
              >
                {purchasedItemKeys.includes(selectedItem.key) ? 'Purchased' : purchaseBusy === selectedItem.key ? 'Purchasing...' : 'Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
