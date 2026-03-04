// frontend/src/pages/ItemsStorage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/ItemsStorage.css';
import BlessingUseModals from '../components/items/blessings/BlessingUseModals';
import oracleWhisperSprite from '../assets/items/blessings/oracle_whisper.png';
import guidingLightSprite from '../assets/items/blessings/guiding_light.png';
import candleOfMercySprite from '../assets/items/blessings/candle_of_mercy.png';
import dispelCurseSprite from '../assets/items/blessings/dispel_curse.png';
import twinFatesSprite from '../assets/items/blessings/twin_fates.png';
import vowelVisionSprite from '../assets/items/blessings/vowel_vision.png';
import bloodOathInkSprite from '../assets/items/illusions/phantoms_mirage.png';
import spiderSwarmSprite from '../assets/items/illusions/spider_swarm.png';
import danceOfTheJesterSprite from '../assets/items/illusions/earthquake.png';
import coneOfColdSprite from '../assets/items/illusions/cone_of_cold.png';
import timeStopSprite from '../assets/items/illusions/time_stop.png';
import sigilOfTheWanderingGlyphSprite from '../assets/items/illusions/sigil_of_the_wandering_glyph.png';
import hexOfCompulsionSprite from '../assets/items/curses/hex_of_compulsion.png';
import executionersCutSprite from '../assets/items/curses/reapers_scythe.png';
import vowelVoodooSprite from '../assets/items/curses/vowel_voodoo.png';
import blindingBrewSprite from '../assets/items/curses/blinding_brew.png';
import consonantCleaverSprite from '../assets/items/curses/consonant_cleaver.png';
import infernalMandateSprite from '../assets/items/curses/infernal_mandate.png';
import sendInTheClownSprite from '../assets/items/illusions/clown.png';
import { oracleWhisper, guidingLight, candleOfMercy, dispelCurse, twinFates, vowelVision } from '../components/items/blessings/index';
import { bloodOathInk, spiderSwarm, sendInTheClown, danceOfTheJester, coneOfCold } from '../components/items/illusions/index';
import { executionersCut } from '../components/items/curses/reapers_scythe';
import { hexOfCompulsion } from '../components/items/curses/hex_of_compulsion';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const CONSONANTS = new Set('bcdfghjklmnpqrstvwxyz'.split(''));
const CURSE_ITEM_KEYS = new Set([
  'hex_of_compulsion',
  'reapers_scythe',
  'vowel_voodoo',
  'blinding_brew',
  'consonant_cleaver',
  'infernal_mandate',
  'edict_of_compulsion',
  'executioners_cut',
]);
const scrollInventoryPageToTop = () => {
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

function isVowelVoodooPayloadValid(payloadValue) {
  const normalized = String(payloadValue || '').trim().toLowerCase();
  if (normalized.length !== 2) return false;
  const letters = normalized.split('');
  return letters.every((letter) => VOWELS.has(letter)) && new Set(letters).size === 2;
}

function isVeilPayloadValid(payloadValue) {
  const normalized = String(payloadValue || '').trim().toLowerCase();
  return normalized === 'left' || normalized === 'right';
}

function isConsonantCleaverPayloadValid(payloadValue) {
  const normalized = String(payloadValue || '').trim().toLowerCase();
  if (normalized.length !== 4) return false;
  const letters = normalized.split('');
  return letters.every((letter) => CONSONANTS.has(letter)) && new Set(letters).size === 4;
}

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
  const [showBlessingCostModal, setShowBlessingCostModal] = useState(false);
  const [showBlessingCandleModal, setShowBlessingCandleModal] = useState(false);
  const [showDispelConfirmModal, setShowDispelConfirmModal] = useState(false);
  const [pendingBlessingUse, setPendingBlessingUse] = useState(null);
  const [showCursedBlessingModal, setShowCursedBlessingModal] = useState(false);
  const [blessingsBlockedByCurse, setBlessingsBlockedByCurse] = useState(false);
  const [isAdminCampaign, setIsAdminCampaign] = useState(false);
  const spriteByKey = {
    oracle_whisper: oracleWhisperSprite,
    guiding_light: guidingLightSprite,
    candle_of_mercy: candleOfMercySprite,
    phantoms_mirage: bloodOathInkSprite,
    spider_swarm: spiderSwarmSprite,
    earthquake: danceOfTheJesterSprite,
    cone_of_cold: coneOfColdSprite,
    hex_of_compulsion: hexOfCompulsionSprite,
    reapers_scythe: executionersCutSprite,
    vowel_voodoo: vowelVoodooSprite,
    blinding_brew: blindingBrewSprite,
    consonant_cleaver: consonantCleaverSprite,
    infernal_mandate: infernalMandateSprite,
    send_in_the_clown: sendInTheClownSprite,
    dispel_curse: dispelCurseSprite,
    twin_fates: twinFatesSprite,
    vowel_vision: vowelVisionSprite,
    sigil_of_the_wandering_glyph: sigilOfTheWanderingGlyphSprite,
    time_stop: timeStopSprite,
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
      guidingLight,
      candleOfMercy,
      dispelCurse,
      twinFates,
      vowelVision,
      bloodOathInk,
      spiderSwarm,
      executionersCut,
      hexOfCompulsion,
      sendInTheClown,
      danceOfTheJester,
      coneOfCold,
    ];
    fallbackItems.forEach((item) => {
      if (item && !map.has(item.key)) {
        map.set(item.key, item);
      }
    });
    return map;
  }, [items]);
  const hasCandleInventory = useMemo(
    () => inventory.some((entry) => entry.item_key === 'candle_of_mercy' && Number(entry.quantity) > 0),
    [inventory]
  );

  const loadState = useCallback(async () => {
    if (!campaignId || !token) return;
    setLoadingPage(true);
    setError('');

    try {
      const [stateRes, progressRes, activeRes] = await Promise.all([
        fetch(`${API_BASE}/api/campaign/shop/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(campaignId) })
        }),
        fetch(`${API_BASE}/api/campaign/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(campaignId) })
        }),
        fetch(`${API_BASE}/api/campaign/items/active`, {
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
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        const effects = Array.isArray(activeData?.effects) ? activeData.effects : [];
        const hasCurseEffect = effects.some((entry) => CURSE_ITEM_KEYS.has(String(entry?.item_key || '')));
        const curseDispersed = Boolean(activeData?.curse_dispersed);
        setBlessingsBlockedByCurse(hasCurseEffect && !curseDispersed);
      } else {
        setBlessingsBlockedByCurse(false);
      }

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

  const handleUseItem = async (
    itemKey,
    targetUserId,
    payloadValue,
    { acceptBlessingCost = false, consumeCandle = false, confirmDispel = false } = {}
  ) => {
    if (useBusy) return;
    const item = itemByKey.get(itemKey);
    const isBlessing = item?.category === 'blessing';
    const requiresBlessingCost = isBlessing && itemKey !== 'dispel_curse';
    if (itemKey === 'candle_of_mercy') {
      const candleMsg = 'Candle of Mercy is only available through retroactive confirmation prompts.';
      setError(candleMsg);
      setTargetModalError(candleMsg);
      return false;
    }
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
    if (itemKey === 'vowel_voodoo') {
      if (!isVowelVoodooPayloadValid(payloadValue)) {
        setError('Choose exactly two vowels before using this item.');
        setTargetModalError('Choose exactly two vowels before using this item.');
        return false;
      }
    }
    if (itemKey === 'blinding_brew') {
      if (!isVeilPayloadValid(payloadValue)) {
        setError('Choose LEFT or RIGHT before using this item.');
        setTargetModalError('Choose LEFT or RIGHT before using this item.');
        return false;
      }
    }
    if (itemKey === 'consonant_cleaver') {
      if (!isConsonantCleaverPayloadValid(payloadValue)) {
        setError('Choose exactly four unique consonants before using this item.');
        setTargetModalError('Choose exactly four unique consonants before using this item.');
        return false;
      }
    }
    if (itemKey === 'dispel_curse' && blessingsBlockedByCurse && !confirmDispel) {
      setPendingBlessingUse({
        itemKey,
        targetUserId: requiresTarget ? Number(selectedTarget) : null,
        payloadValue: String(payloadValue || '').trim().toLowerCase(),
      });
      setShowBlessingCandleModal(false);
      setShowBlessingCostModal(false);
      setShowDispelConfirmModal(true);
      setTargetModalItem(null);
      return false;
    }
    if (requiresBlessingCost && !acceptBlessingCost) {
      if (itemKey !== 'dispel_curse' && blessingsBlockedByCurse) {
        setShowBlessingCandleModal(false);
        setShowBlessingCostModal(false);
        setPendingBlessingUse(null);
        setTargetModalItem(null);
        setShowCursedBlessingModal(true);
        setTimeout(scrollInventoryPageToTop, 0);
        return false;
      }
      setPendingBlessingUse({
        itemKey,
        targetUserId: requiresTarget ? Number(selectedTarget) : null,
        payloadValue: String(payloadValue || '').trim().toLowerCase(),
      });
      setShowBlessingCandleModal(false);
      setShowBlessingCostModal(true);
      setTargetModalItem(null);
      return false;
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
          effect_payload: (
            item?.payload_type || itemKey === 'vowel_voodoo' || itemKey === 'blinding_brew' || itemKey === 'consonant_cleaver'
          )
            ? { value: String(payloadValue || '').trim().toLowerCase() }
            : null,
          accept_blessing_cost: requiresBlessingCost,
          consume_candle_of_mercy: requiresBlessingCost && consumeCandle,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const detailMessage = typeof data?.detail === 'string'
          ? data.detail
          : (data?.detail ? JSON.stringify(data.detail) : '');
        throw new Error(detailMessage || 'Use failed');
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
      if (String(message).toLowerCase().includes('final day of the cycle')) {
        setShowBlessingCandleModal(false);
        setShowBlessingCostModal(false);
        setPendingBlessingUse(null);
        setTargetModalItem(null);
        setInfoModalItem(null);
        const finalDayMsg = "You can't use items on the last day of the cycle.";
        setError(finalDayMsg);
        setTargetModalError(finalDayMsg);
        return false;
      }
      const normalized = message.toLowerCase();
      if (normalized.includes('dispel curse can only be used while cursed')) {
        const notCursedMsg = 'Dispel Curse can only be used while cursed.';
        setError(notCursedMsg);
        setTargetModalError(notCursedMsg);
        return false;
      }
      if (
        normalized.includes('not enough troops')
        || normalized.includes('sacrifice for this blessing')
        || normalized.includes('earn more troops')
      ) {
        setShowBlessingCandleModal(false);
        setShowBlessingCostModal(false);
        setPendingBlessingUse(null);
        setTargetModalItem(null);
        setTimeout(scrollInventoryPageToTop, 0);
      }
      if (
        normalized.includes('while cursed')
        || normalized.includes('may not use blessings')
        || normalized.includes('while hexed')
      ) {
        setShowBlessingCandleModal(false);
        setShowBlessingCostModal(false);
        setPendingBlessingUse(null);
        setTargetModalItem(null);
        setShowCursedBlessingModal(true);
        setTimeout(scrollInventoryPageToTop, 0);
      }
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

  const handleBlessingSacrifice = async () => {
    if (!pendingBlessingUse) return;
    const success = await handleUseItem(
      pendingBlessingUse.itemKey,
      pendingBlessingUse.targetUserId,
      pendingBlessingUse.payloadValue,
      { acceptBlessingCost: true, consumeCandle: false }
    );
    if (success) {
      setShowBlessingCostModal(false);
      setShowBlessingCandleModal(false);
      setPendingBlessingUse(null);
    }
  };

  const handleBlessingUseCandle = () => {
    setShowBlessingCostModal(false);
    setShowBlessingCandleModal(true);
  };

  const handleBlessingCandleNo = () => {
    setShowBlessingCandleModal(false);
    setShowBlessingCostModal(true);
  };

  const handleBlessingCandleYes = async () => {
    if (!pendingBlessingUse) return;
    const success = await handleUseItem(
      pendingBlessingUse.itemKey,
      pendingBlessingUse.targetUserId,
      pendingBlessingUse.payloadValue,
      { acceptBlessingCost: true, consumeCandle: true }
    );
    if (success) {
      setShowBlessingCandleModal(false);
      setShowBlessingCostModal(false);
      setPendingBlessingUse(null);
    }
  };

  const handleDispelConfirmYes = async () => {
    if (!pendingBlessingUse) return;
    const success = await handleUseItem(
      pendingBlessingUse.itemKey,
      pendingBlessingUse.targetUserId,
      pendingBlessingUse.payloadValue,
      { confirmDispel: true }
    );
    if (success) {
      setShowDispelConfirmModal(false);
      setPendingBlessingUse(null);
    }
  };

  const handleDispelConfirmNo = () => {
    setShowDispelConfirmModal(false);
    setPendingBlessingUse(null);
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
            <button className="btn" onClick={() => navigate(`/campaign/${campaignId}/market`)}>
              Visit Market
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
                          <div
                            className={`items-card-sprite${spriteByKey[inv.item_key] ? " has-image" : ""}`}
                            role={spriteByKey[inv.item_key] ? 'button' : undefined}
                            tabIndex={spriteByKey[inv.item_key] ? 0 : undefined}
                            aria-label={spriteByKey[inv.item_key] ? `View ${item?.name || inv.item_key}` : undefined}
                            onClick={spriteByKey[inv.item_key] ? () => setInfoModalItem(item) : undefined}
                            onKeyDown={spriteByKey[inv.item_key]
                              ? (event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setInfoModalItem(item);
                                  }
                                }
                              : undefined}
                          >
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
            {targetModalItem.key === 'vowel_voodoo' && (
              <div className="items-modal-field">
                <label className="items-modal-label" htmlFor="items-vowel-voodoo-input">
                  Choose 2 vowels
                </label>
                <input
                  id="items-vowel-voodoo-input"
                  className="items-modal-input"
                  type="text"
                  value={targetModalPayload}
                  maxLength={2}
                  placeholder="ae"
                  onChange={(event) => {
                    const nextValue = event.target.value
                      .replace(/[^aeiou]/gi, '')
                      .slice(0, 2)
                      .toLowerCase();
                    setTargetModalPayload(nextValue);
                  }}
                />
              </div>
            )}
            {targetModalItem.key === 'blinding_brew' && (
              <div className="items-modal-field">
                <label className="items-modal-label" htmlFor="items-veil-side-input">
                  Choose side to obscure
                </label>
                <select
                  id="items-veil-side-input"
                  className="items-target-select"
                  value={targetModalPayload}
                  onChange={(event) => setTargetModalPayload(event.target.value)}
                >
                  <option value="">Select side</option>
                  <option value="left">LEFT</option>
                  <option value="right">RIGHT</option>
                </select>
              </div>
            )}
            {targetModalItem.key === 'consonant_cleaver' && (
              <div className="items-modal-field">
                <label className="items-modal-label" htmlFor="items-consonant-cleaver-input">
                  Choose 4 consonants
                </label>
                <input
                  id="items-consonant-cleaver-input"
                  className="items-modal-input"
                  type="text"
                  value={targetModalPayload}
                  maxLength={4}
                  placeholder="bcdf"
                  onChange={(event) => {
                    const nextValue = event.target.value
                      .replace(/[^a-z]/gi, '')
                      .toLowerCase()
                      .split('')
                      .filter((letter) => CONSONANTS.has(letter))
                      .join('')
                      .slice(0, 4);
                    setTargetModalPayload(nextValue);
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
                  (
                    targetModalItem.payload_type
                      ? !targetModalPayload
                      : targetModalItem.key === 'vowel_voodoo'
                        ? !isVowelVoodooPayloadValid(targetModalPayload)
                        : targetModalItem.key === 'blinding_brew'
                          ? !isVeilPayloadValid(targetModalPayload)
                          : targetModalItem.key === 'consonant_cleaver'
                            ? !isConsonantCleaverPayloadValid(targetModalPayload)
                          : false
                  ) ||
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
      <BlessingUseModals
        showCostModal={showBlessingCostModal}
        showCandleModal={showBlessingCandleModal}
        showDispelConfirmModal={showDispelConfirmModal}
        pendingItemName={pendingBlessingUse?.itemKey ? (itemByKey.get(pendingBlessingUse.itemKey)?.name || pendingBlessingUse.itemKey) : ''}
        hasCandleInventory={hasCandleInventory}
        onCloseCost={() => {
          setShowBlessingCostModal(false);
          setPendingBlessingUse(null);
        }}
        onSacrifice={handleBlessingSacrifice}
        onUseCandle={handleBlessingUseCandle}
        onCandleYes={handleBlessingCandleYes}
        onCandleNo={handleBlessingCandleNo}
        onDispelConfirm={handleDispelConfirmYes}
        onDispelCancel={handleDispelConfirmNo}
      />
      {showCursedBlessingModal && (
        <div className="items-modal-overlay" onClick={() => setShowCursedBlessingModal(false)}>
          <div className="items-modal" onClick={(event) => event.stopPropagation()}>
            <div className="items-modal-header">
              <h3>Cursed</h3>
              <button className="items-modal-close" onClick={() => setShowCursedBlessingModal(false)} type="button">
                ×
              </button>
            </div>
            <p className="items-modal-description">You are cursed and can&apos;t use blessings.</p>
            <p className="items-modal-description">Purchase Dispel Curse or try another day.</p>
            <div className="modal-buttons">
              <button className="troop-btn close-btn" type="button" onClick={() => setShowCursedBlessingModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
