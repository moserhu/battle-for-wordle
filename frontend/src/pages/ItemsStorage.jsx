// frontend/src/pages/ItemsStorage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/ItemsStorage.css';
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
import {
  oracleWhisper,
  cartographersInsight,
  candleOfMercy,
  bloodOathInk,
  spiderSwarm,
  executionersCut,
  edictOfCompulsion,
  sendInTheClown,
} from '../components/items/basic';
import {
  danceOfTheJester,
  coneOfCold,
  sealOfSilence,
  voidbrand,
} from '../components/items/spells';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function ItemsStorage() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { token, user, isAuthenticated, loading } = useAuth();

  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState('');
  const [useBusy, setUseBusy] = useState('');
  const [targetModalItem, setTargetModalItem] = useState(null);
  const [targetModalTargets, setTargetModalTargets] = useState([]);
  const [targetModalSelection, setTargetModalSelection] = useState('');
  const [targetModalLoading, setTargetModalLoading] = useState(false);
  const [targetModalPayload, setTargetModalPayload] = useState('');
  const [targetModalError, setTargetModalError] = useState('');
  const [infoModalItem, setInfoModalItem] = useState(null);
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

  const itemByKey = useMemo(() => {
    const map = new Map();
    items.forEach((item) => map.set(item.key, item));
    const fallbackItems = [
      oracleWhisper,
      cartographersInsight,
      candleOfMercy,
      bloodOathInk,
      spiderSwarm,
      executionersCut,
      edictOfCompulsion,
      sendInTheClown,
      danceOfTheJester,
      coneOfCold,
      sealOfSilence,
      voidbrand,
    ];
    fallbackItems.forEach((item) => {
      if (item && !map.has(item.key)) {
        map.set(item.key, item);
      }
    });
    return map;
  }, [items]);

  const loadState = useCallback(async () => {
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
        setIsAdminCampaign(Boolean(progress?.is_admin_campaign));
      }

      if (!stateRes.ok) {
        const err = await stateRes.json();
        throw new Error(err?.detail || 'Failed to load items');
      }

      const state = await stateRes.json();
      const catalogItems = Array.isArray(state?.catalog) ? state.catalog : [];
      setItems(catalogItems.length ? catalogItems : (Array.isArray(state?.items) ? state.items : []));
      setInventory(Array.isArray(state?.inventory) ? state.inventory : []);
      const inventoryRows = Array.isArray(state?.inventory) ? state.inventory : [];
      setInventory(inventoryRows.filter((entry) => Number(entry.quantity) > 0));

    } catch (err) {
      setError(err?.message || 'Failed to load items.');
    } finally {
      setLoadingPage(false);
    }
  }, [campaignId, token]);

  useEffect(() => {
    if (!loading && token && campaignId) {
      loadState();
    }
  }, [loading, token, campaignId, loadState]);

  const handleUseItem = async (itemKey, targetUserId, payloadValue) => {
    if (useBusy) return;
    const item = itemByKey.get(itemKey);
    const requiresTarget = item?.requires_target;
    const selectedTarget = targetUserId;
    if (requiresTarget && !selectedTarget) {
      setError('Select a target before using this item.');
      setTargetModalError('Select a target before using this item.');
      return false;
    }
    if (item?.payload_type) {
      const normalized = String(payloadValue || '').trim().toLowerCase();
      if (item.payload_type === 'letter' && (!normalized || normalized.length !== 1 || !/^[a-z]$/i.test(normalized))) {
        setError('Choose a single letter before using this item.');
        setTargetModalError('Choose a single letter before using this item.');
        return false;
      }
      if (item.payload_type === 'word' && (!normalized || normalized.length !== 5 || !/^[a-z]{5}$/i.test(normalized))) {
        setError('Choose a 5-letter word before using this item.');
        setTargetModalError('Choose a 5-letter word before using this item.');
        return false;
      }
    }

    setUseBusy(itemKey);
    setError('');
    setTargetModalError('');
    try {
      const res = await fetch(`${API_BASE}/api/campaign/items/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          campaign_id: Number(campaignId),
          item_key: itemKey,
          target_user_id: requiresTarget ? Number(selectedTarget) : null,
          effect_payload: item?.payload_type ? { value: String(payloadValue || '').trim().toLowerCase() } : null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Use failed');
      }
      await loadState();
      if (!requiresTarget) {
        try {
          const key = `bfw:self-effect:${Number(campaignId)}`;
          localStorage.setItem(key, String(Date.now()));
          window.dispatchEvent(new CustomEvent("bfw:self-effect", { detail: { campaignId: Number(campaignId) } }));
        } catch {}
      }
      return true;
    } catch (err) {
      const message = err?.message || 'Use failed.';
      const normalized = message.toLowerCase();
      if (
        normalized.includes('invalid word') ||
        normalized.includes('playable word') ||
        normalized.includes('valid guess')
      ) {
        const invalidMsg = 'Word must be a valid guess.';
        setError(invalidMsg);
        setTargetModalError(invalidMsg);
      } else {
        setError(message);
        setTargetModalError(message);
      }
      return false;
    } finally {
      setUseBusy('');
    }
  };

  const openTargetModal = async (item) => {
    setTargetModalItem(item);
    setTargetModalSelection('');
    setTargetModalTargets([]);
    setTargetModalPayload('');
    setTargetModalError('');
    setTargetModalLoading(true);
    if (!item?.requires_target) {
      setTargetModalLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/campaign/targets/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: Number(campaignId), item_key: item.key })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to load targets');
      }
      const targetsData = Array.isArray(data) ? data : [];
      setTargetModalTargets(targetsData);
    } catch (err) {
      setError(err?.message || 'Failed to load targets.');
    } finally {
      setTargetModalLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className={`items-wrapper${isAdminCampaign ? " admin-theme" : ""}`}>
      <header className="items-header">
        <div className="items-header-inner">
          <div>
            <h1 className="items-title">My Items</h1>
            <p className="items-subtitle">Use items you have stored for this campaign.</p>
          </div>
          <div className="items-header-actions">
            <button className="btn" onClick={() => navigate(`/campaign/${campaignId}/shop`)}>
              Visit Shop
            </button>
            <button className="btn" onClick={() => navigate(`/campaign/${campaignId}`)}>
              Back to Camp
            </button>
          </div>
        </div>
      </header>

      <section className="items-surface">
        {error && <div className="items-panel items-error">{error}</div>}
        {loadingPage ? (
          <div className="items-panel">Loading items...</div>
        ) : (
          <div className="items-grid">
            <div className="items-panel">
              <div className="items-panel-header">
                <h2>Inventory</h2>
                <span className="items-pill">Stored</span>
              </div>
              <div className="items-cards">
                {inventory.length === 0 ? (
                  <div className="items-empty">No items stored yet.</div>
                ) : (
                  inventory.map((inv) => {
                    const item = itemByKey.get(inv.item_key);
                    return (
                      <div key={inv.item_key} className="items-card">
                        <div className="items-card-body">
                          <div className="items-card-title">{item?.name || inv.item_key}</div>
                          <div className={`items-card-sprite${spriteByKey[inv.item_key] ? " has-image" : ""}`}>
                            {spriteByKey[inv.item_key] ? (
                              <img
                                src={spriteByKey[inv.item_key]}
                                alt={item?.name || inv.item_key}
                                className="items-card-sprite-img"
                              />
                            ) : (
                              <span>Sprite</span>
                            )}
                          </div>
                          <div className="items-card-footer">
                            <div className="items-qty">x{inv.quantity}</div>
                            <button
                              className="items-card-info"
                              onClick={() => setInfoModalItem(item)}
                              aria-label={`Info for ${item?.name || inv.item_key}`}
                              type="button"
                            >
                              i
                            </button>
                          </div>
                        </div>
                        <button
                          className="btn"
                          disabled={useBusy === inv.item_key}
                          onClick={() => openTargetModal(item)}
                        >
                          {useBusy === inv.item_key ? 'Using...' : 'Use'}
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
      {infoModalItem && (
        <div className="items-modal-overlay" onClick={() => setInfoModalItem(null)}>
          <div className="items-modal" onClick={(event) => event.stopPropagation()}>
            <div className="items-modal-header">
              <h3>{infoModalItem.name}</h3>
              <button className="items-modal-close" onClick={() => setInfoModalItem(null)} type="button">
                ×
              </button>
            </div>
            <div className="items-modal-tag-row">
              {infoModalItem.affects_others ? (
                <span className="items-modal-tag items-modal-tag--enemy">Target Enemy</span>
              ) : (
                <span className="items-modal-tag items-modal-tag--self">Target Self</span>
              )}
            </div>
            <div className="items-modal-body">
              <div className="items-modal-image">
                {spriteByKey[infoModalItem.key] && (
                  <img
                    src={spriteByKey[infoModalItem.key]}
                    alt={infoModalItem.name}
                    className="items-modal-image-img"
                  />
                )}
              </div>
              <div className="items-modal-text">
                <p className="items-modal-description">{infoModalItem.description}</p>
              </div>
            </div>
            <div className="items-modal-actions">
              <button
                className="btn"
                onClick={() => {
                  setInfoModalItem(null);
                  openTargetModal(infoModalItem);
                }}
                type="button"
              >
                Use
              </button>
            </div>
          </div>
        </div>
      )}
      {targetModalItem && (
        <div className="items-modal-overlay" onClick={() => setTargetModalItem(null)}>
          <div className="items-modal" onClick={(event) => event.stopPropagation()}>
            <div className="items-modal-header">
              <h3>{targetModalItem.name}</h3>
              <button className="items-modal-close" onClick={() => setTargetModalItem(null)} type="button">
                ×
              </button>
            </div>
            <p className="items-modal-description">{targetModalItem.description}</p>
            {targetModalError && (
              <div className="items-modal-error" role="alert">
                {targetModalError}
              </div>
            )}
            {targetModalItem.payload_type && (
              <div className="items-modal-field">
                <label className="items-modal-label" htmlFor="items-payload-input">
                  {targetModalItem.payload_type === 'letter' ? 'Choose a letter' : 'Choose a word'}
                </label>
                <input
                  id="items-payload-input"
                  className="items-modal-input"
                  type="text"
                  value={targetModalPayload}
                  maxLength={targetModalItem.payload_type === 'letter' ? 1 : 5}
                  placeholder={targetModalItem.payload_type === 'letter' ? 'e' : 'words'}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (targetModalItem.payload_type === 'letter') {
                      const letterOnly = nextValue.replace(/[^a-z]/gi, '').slice(0, 1);
                      setTargetModalPayload(letterOnly);
                    } else {
                      setTargetModalPayload(nextValue);
                    }
                  }}
                />
              </div>
            )}
            {targetModalItem.requires_target && (
              <>
                <p className="items-modal-description">Select a target to use this item.</p>
                {targetModalLoading ? (
                  <div className="items-empty">Loading targets...</div>
                ) : (
                  <select
                    className="items-target-select"
                    value={targetModalSelection}
                    onChange={(event) => setTargetModalSelection(event.target.value)}
                  >
                    <option value="">Select target</option>
                {targetModalTargets.map((target) => (
                  <option key={target.user_id} value={target.user_id}>
                    {target.display_name}{target.blocked ? ' (unavailable)' : ''}
                  </option>
                ))}
              </select>
            )}
            {targetModalTargets.some((target) => target.blocked) && (
              <div className="items-target-note">
                Targets marked unavailable already have a conflicting effect queued.
              </div>
            )}
              </>
            )}
            <div className="modal-buttons">
              <button
                className="troop-btn"
                onClick={async () => {
                  if (targetModalItem.requires_target && !targetModalSelection) return;
                  const success = await handleUseItem(
                    targetModalItem.key,
                    targetModalSelection,
                    targetModalPayload
                  );
                  if (success) {
                    setTargetModalItem(null);
                  }
                }}
                disabled={
                  (targetModalItem.requires_target && !targetModalSelection) ||
                  (targetModalItem.payload_type && !targetModalPayload) ||
                  targetModalTargets.some((target) => String(target.user_id) === String(targetModalSelection) && target.blocked) ||
                  useBusy === targetModalItem.key
                }
              >
                Use
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
