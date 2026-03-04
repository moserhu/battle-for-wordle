import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import WordGrid from '../components/WordGrid';
import Keyboard from '../components/Keyboard';
import DoubleDownModal from "../components/DoubleDownModal";
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/GameScreen.css';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthProvider';
import RulerTitleModal from '../components/RulerTitleModal';
import DayReplayInfoModal from '../components/DayReplayInfoModal';
import AdminToolsModal from '../components/admin/AdminToolsModal';
import WeeklyRewardModal from '../components/rewards/WeeklyRewardModal';
import { applyAbsentLetters, getCartographersLetters, applyOracleCorrectLetter, getOraclePlacement } from '../components/items/blessings/index';
import BlessingUseModals from '../components/items/blessings/BlessingUseModals';
import { hasBloodOathInk, useClownJumpscare, ClownOverlay, useSpiderSwarm, getSpiderMotionProps, useJesterDance, getConeTurns, decrementConeTurns, shouldShowConeOverlay, getConeOpacity, WanderingGlyphOverlay, hasTimeStop, TIME_STOP_REVEAL_DELAY_MS } from '../components/items/illusions/index';
import { hasExecutionersCut } from '../components/items/curses/reapers_scythe';
import hexRuneIcon from '../assets/ui/hex_rune.png';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

const EMPTY_GRID = Array.from({ length: 6 }, () => Array(5).fill(""));
const FORCED_UTTERANCE_KEYS = new Set(["hex_of_compulsion", "edict_of_compulsion"]);
const toFiveLetterRow = (value) => {
  const normalized = String(value || "").toUpperCase();
  return Array.from({ length: 5 }, (_, idx) => normalized[idx] || "");
};
const normalizeGuessRow = (row) =>
  Array.from({ length: 5 }, (_, idx) => (Array.isArray(row) ? String(row[idx] || "").toUpperCase() : ""));
const getNextEmptyCol = (row) => {
  for (let idx = 0; idx < 5; idx += 1) {
    if (!row[idx]) return idx;
  }
  return 5;
};

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

function getCountdownFrom(now, target) {
  const diffMs = Math.max(target - now, 0);
  return {
    hours: Math.floor(diffMs / (1000 * 60 * 60)),
    minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
  };
}


function isFinalCampaignDay(campaignDay) {
  return campaignDay && campaignDay.day === campaignDay.total;
}

const CURSE_DETAILS_BY_KEY = {
  hex_of_compulsion: {
    name: 'Hex of Forced Utterance',
    describe: (payloadValue) => {
      if (payloadValue) {
        return `Your first guess is forced to ${String(payloadValue).toUpperCase()}.`;
      }
      return 'Your first guess is forced by the curse.';
    },
  },
  edict_of_compulsion: {
    name: 'Hex of Forced Utterance',
    describe: (payloadValue) => {
      if (payloadValue) {
        return `Your first guess is forced to ${String(payloadValue).toUpperCase()}.`;
      }
      return 'Your first guess is forced by the curse.';
    },
  },
  reapers_scythe: {
    name: "Reaper's Scythe",
    describe: () => 'You have one fewer guess available today.',
  },
  executioners_cut: {
    name: "Reaper's Scythe",
    describe: () => 'You have one fewer guess available today.',
  },
  vowel_voodoo: {
    name: 'Vowel Voodoo',
    describe: (payloadValue) => {
      if (payloadValue) {
        return `Vowels ${String(payloadValue).toUpperCase().split("").join(", ")} are blocked for your first two guesses.`;
      }
      return 'Two vowels are blocked for your first two guesses.';
    },
  },
  consonant_cleaver: {
    name: 'Consonant Cleaver',
    describe: (payloadValue) => {
      if (payloadValue) {
        return `Consonants ${String(payloadValue).toUpperCase().split("").join(", ")} are blocked for your first two guesses.`;
      }
      return 'Several consonants are blocked for your first two guesses.';
    },
  },
  blinding_brew: {
    name: 'Veil of Obscured Sight',
    describe: (payloadValue) => {
      if (payloadValue) {
        return `${String(payloadValue).toUpperCase()} columns are obscured for your first two guesses.`;
      }
      return 'Part of the board feedback is obscured for your first two guesses.';
    },
  },
  infernal_mandate: {
    name: 'Infernal Mandate',
    describe: () => 'You must play all discovered letters and guess playable words or lose 5 troops (max 20).',
  },
};

function getCurseEffectParts(itemKey, payloadValue, fallbackText) {
  if ((itemKey === "hex_of_compulsion" || itemKey === "edict_of_compulsion") && payloadValue) {
    return {
      prefix: "Your first guess is forced to ",
      emphasis: String(payloadValue).toUpperCase(),
      suffix: ".",
    };
  }
  if (itemKey === "vowel_voodoo" && payloadValue) {
    return {
      prefix: "Vowels ",
      emphasis: String(payloadValue).toUpperCase().split("").join(", "),
      suffix: " are blocked for your first two guesses.",
    };
  }
  if (itemKey === "consonant_cleaver" && payloadValue) {
    return {
      prefix: "Consonants ",
      emphasis: String(payloadValue).toUpperCase().split("").join(", "),
      suffix: " are blocked for your first two guesses.",
    };
  }
  if (itemKey === "blinding_brew" && payloadValue) {
    return {
      prefix: "",
      emphasis: String(payloadValue).toUpperCase(),
      suffix: " columns are obscured for your first two guesses.",
    };
  }
  if (itemKey === "infernal_mandate") {
    return {
      prefix: "You must play all discovered letters and guess playable words or lose ",
      emphasis: "5 troops",
      suffix: " (max 20).",
    };
  }
  return {
    prefix: fallbackText,
    emphasis: "",
    suffix: "",
  };
}


export default function GameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, isAuthenticated, loading } = useAuth();

  const [campaignId, setCampaignId] = useState(null);
  const [guesses, setGuesses] = useState(EMPTY_GRID);
  const [results, setResults] = useState(Array(6).fill(null));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [letterStatus, setLetterStatus] = useState({});
  const [campaignDay, setCampaignDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [campaignEnded, setCampaignEnded] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showTroopModal, setShowTroopModal] = useState(false);
  const [troopsEarned, setTroopsEarned] = useState(0);
  const [showDoubleDownModal, setShowDoubleDownModal] = useState(false);
  const [pendingDoubleDownPrompt, setPendingDoubleDownPrompt] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failedWord, setFailedWord] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [doubleDownStatus, setDoubleDownStatus] = useState({
    activated: false,
    usedThisWeek: false
  });
  const [hasOfferedDoubleDown, setHasOfferedDoubleDown] = useState(false);
  const [rulerTitle, setRulerTitle] = useState('Current Ruler');
  const [showRulerModal, setShowRulerModal] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [showDayReplayInfo, setShowDayReplayInfo] = useState(false);
  const [hintScroll, setHintScroll] = useState(null);
  const [hintPulse, setHintPulse] = useState(false);
  const lastHintRef = useRef("");
  const [targetEffects, setTargetEffects] = useState([]);
  const [curseDispersed, setCurseDispersed] = useState(false);
  const [coneTurnsLeft, setConeTurnsLeft] = useState(0);
  const [timeStopRevealRow, setTimeStopRevealRow] = useState(null);
  const [timeStopRevealedCount, setTimeStopRevealedCount] = useState(5);
  const [statusEffects, setStatusEffects] = useState([]);
  const [hintPlaced, setHintPlaced] = useState(false);
  const [twinFatesPlaced, setTwinFatesPlaced] = useState(false);
  const [showMercyModal, setShowMercyModal] = useState(false);
  const [mercyBonus, setMercyBonus] = useState(0);
  const [mercyBusy, setMercyBusy] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminRefresh, setAdminRefresh] = useState(0);
  const [edictApplied, setEdictApplied] = useState(false);
  const [dailyWord, setDailyWord] = useState("");
  const { showClownOverlay, triggerClown } = useClownJumpscare();
  const [showCampMenu, setShowCampMenu] = useState(false);
  const [showSelfItemsModal, setShowSelfItemsModal] = useState(false);
  const [selfItemsLoading, setSelfItemsLoading] = useState(false);
  const [selfItemsError, setSelfItemsError] = useState('');
  const [selfInventory, setSelfInventory] = useState([]);
  const [mercyInventoryCount, setMercyInventoryCount] = useState(0);
  const [selfItemsCatalog, setSelfItemsCatalog] = useState([]);
  const [selfPayloadValues, setSelfPayloadValues] = useState({});
  const [selfUseBusy, setSelfUseBusy] = useState('');
  const [showBlessingCostModal, setShowBlessingCostModal] = useState(false);
  const [showBlessingCandleModal, setShowBlessingCandleModal] = useState(false);
  const [pendingBlessingItemKey, setPendingBlessingItemKey] = useState('');
  const [showCurseInfoModal, setShowCurseInfoModal] = useState(false);
  const [showInfernalModal, setShowInfernalModal] = useState(false);
  const [infernalPenaltyAmount, setInfernalPenaltyAmount] = useState(0);
  const [infernalViolationType, setInfernalViolationType] = useState('letters');
  const doubleDownEligible = !doubleDownStatus.activated && !doubleDownStatus.usedThisWeek;

  // Weekly winner reward selection (cycle gate)
  const [weeklyReward, setWeeklyReward] = useState(null);
  const [showWeeklyRewardModal, setShowWeeklyRewardModal] = useState(false);
  const [weeklyRecipients, setWeeklyRecipients] = useState([]);
  const [weeklyRewardBusy, setWeeklyRewardBusy] = useState(false);
  const [weeklyRewardError, setWeeklyRewardError] = useState('');
  const campMenuRef = useRef(null);
  const playAreaRef = useRef(null);
  const lastCampaignIdRef = useRef(null);

  const triggerShake = useCallback(() => {
  setShake(true);
  setTimeout(() => setShake(false), 400);
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (!showCampMenu) return;
    const handleClick = (event) => {
      if (campMenuRef.current && !campMenuRef.current.contains(event.target)) {
        setShowCampMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCampMenu]);

  const selfItemByKey = useMemo(() => {
    const map = new Map();
    selfItemsCatalog.forEach((item) => map.set(item.key, item));
    return map;
  }, [selfItemsCatalog]);

  const selfUsableInventory = useMemo(() => (
    selfInventory.filter((entry) => {
      const item = selfItemByKey.get(entry.item_key);
      return item && item.key !== 'candle_of_mercy' && !item.requires_target && Number(entry.quantity) > 0;
    })
  ), [selfInventory, selfItemByKey]);
  const hasCandleInventory = useMemo(
    () => selfInventory.some((entry) => entry.item_key === 'candle_of_mercy' && Number(entry.quantity) > 0),
    [selfInventory]
  );
  const pendingBlessingItem = useMemo(
    () => (pendingBlessingItemKey ? selfItemByKey.get(pendingBlessingItemKey) : null),
    [pendingBlessingItemKey, selfItemByKey]
  );

  const loadSelfItems = useCallback(async () => {
    if (!campaignId || !token) return;
    setSelfItemsLoading(true);
    setSelfItemsError('');
    try {
      const res = await fetch(`${API_BASE}/api/campaign/shop/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to load items.');
      }
      setSelfItemsCatalog(Array.isArray(data?.items) ? data.items : []);
      const inventoryRows = Array.isArray(data?.inventory) ? data.inventory : [];
      setSelfInventory(inventoryRows.filter((entry) => Number(entry.quantity) > 0));
      const mercyQty = inventoryRows.find((entry) => entry.item_key === 'candle_of_mercy')?.quantity ?? 0;
      setMercyInventoryCount(Number(mercyQty) || 0);
    } catch (err) {
      setSelfItemsError(err?.message || 'Failed to load items.');
    } finally {
      setSelfItemsLoading(false);
    }
  }, [campaignId, token]);

  const refreshMercyInventory = useCallback(async () => {
    if (!campaignId || !token) return;
    try {
      const res = await fetch(`${API_BASE}/api/campaign/shop/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok) return;
      const inventoryRows = Array.isArray(data?.inventory) ? data.inventory : [];
      const mercyQty = inventoryRows.find((entry) => entry.item_key === 'candle_of_mercy')?.quantity ?? 0;
      setMercyInventoryCount(Number(mercyQty) || 0);
    } catch {
      // ignore
    }
  }, [campaignId, token]);

  const refreshSelfEffects = useCallback(async () => {
    if (!campaignId || !token) return;
    try {
      const [hintRes, effectsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/campaign/items/hint`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId }),
        }),
        fetch(`${API_BASE}/api/campaign/items/active`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId }),
        }),
        fetch(`${API_BASE}/api/campaign/items/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId }),
        }),
      ]);

      const hintData = await hintRes.json();
      const effectsData = await effectsRes.json();
      const statusData = await statusRes.json();

      if (hintData?.hint?.letter && hintData?.hint?.position) {
        setHintScroll(hintData.hint);
      } else {
        setHintScroll(null);
      }

      if (effectsData?.effects) {
        setTargetEffects(effectsData.effects);
        setCurseDispersed(Boolean(effectsData?.curse_dispersed));
        setConeTurnsLeft(getConeTurns(effectsData.effects));
      } else {
        setTargetEffects([]);
        setCurseDispersed(false);
        setConeTurnsLeft(0);
      }

      if (statusData?.effects) {
        setStatusEffects(statusData.effects);
      } else {
        setStatusEffects([]);
      }
      await refreshMercyInventory();
    } catch {
      // Silently ignore refresh failures; main gameplay flow still works.
    }
  }, [campaignId, token, refreshMercyInventory]);

  useEffect(() => {
    const hintKey = hintScroll ? `${hintScroll.letter}-${hintScroll.position}` : "";
    if (!hintKey || hintKey === lastHintRef.current) return;
    lastHintRef.current = hintKey;
    setHintPulse(true);
    const timer = setTimeout(() => setHintPulse(false), 1200);
    return () => clearTimeout(timer);
  }, [hintScroll]);

  useEffect(() => {
    if (!campaignId) return;
    const handleSelfEffect = (event) => {
      if (Number(event?.detail?.campaignId) !== Number(campaignId)) return;
      refreshSelfEffects();
    };
    const handleStorage = (event) => {
      if (!event?.key || !event?.key.startsWith("bfw:self-effect:")) return;
      const parts = event.key.split(":");
      const keyCampaignId = parts[2];
      if (Number(keyCampaignId) !== Number(campaignId)) return;
      refreshSelfEffects();
    };
    window.addEventListener("bfw:self-effect", handleSelfEffect);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("bfw:self-effect", handleSelfEffect);
      window.removeEventListener("storage", handleStorage);
    };
  }, [campaignId, refreshSelfEffects]);

  const openSelfItemsModal = () => {
    setShowSelfItemsModal(true);
    loadSelfItems();
  };

  const toggleWeeklyRecipient = (userId) => {
    if (!weeklyReward?.pending) return;
    setWeeklyRewardError('');
    setWeeklyRecipients((prev) => {
      const exists = prev.includes(userId);
      if (exists) return prev.filter((id) => id !== userId);
      // cap selection at required count
      if (prev.length >= (weeklyReward.recipient_count || 0)) return prev;
      return [...prev, userId];
    });
  };

  const submitWeeklyReward = async () => {
    if (!weeklyReward?.pending || weeklyRewardBusy) return;
    const required = weeklyReward.recipient_count || 0;
    if (weeklyRecipients.length !== required) {
      setWeeklyRewardError(`Pick exactly ${required} player${required === 1 ? '' : 's'}.`);
      return;
    }
    setWeeklyRewardBusy(true);
    setWeeklyRewardError('');
    try {
      const res = await fetch(`${API_BASE}/api/campaign/rewards/choose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaign_id: campaignId,
          recipient_user_ids: weeklyRecipients,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Could not save choices.');
      }
      setShowWeeklyRewardModal(false);
      setWeeklyReward(null);
      setWeeklyRecipients([]);
    } catch (e) {
      setWeeklyRewardError(e?.message || 'Could not save choices.');
    } finally {
      setWeeklyRewardBusy(false);
    }
  };

  const buildSelfEffectPayload = useCallback((itemKey, item) => {
    if (!item?.payload_type) return null;
    const rawValue = String(selfPayloadValues[itemKey] || '').trim().toLowerCase();
    if (item.payload_type === 'letter' && (!rawValue || rawValue.length !== 1 || !/^[a-z]$/i.test(rawValue))) {
      setSelfItemsError('Choose a single letter before using this item.');
      return null;
    }
    if (item.payload_type === 'word' && (!rawValue || rawValue.length !== 5 || !/^[a-z]{5}$/i.test(rawValue))) {
      setSelfItemsError('Choose a 5-letter word before using this item.');
      return null;
    }
    return { value: rawValue };
  }, [selfPayloadValues]);

  const executeSelfItemUse = useCallback(async (itemKey, { consumeCandle = false } = {}) => {
    if (selfUseBusy) return false;
    const item = selfItemByKey.get(itemKey);
    if (!item) return false;
    const effectPayload = buildSelfEffectPayload(itemKey, item);
    if (item?.payload_type && !effectPayload) return false;

    const isBlessing = item?.category === 'blessing';

    setSelfUseBusy(itemKey);
    setSelfItemsError('');
    try {
      const res = await fetch(`${API_BASE}/api/campaign/items/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaign_id: campaignId,
          item_key: itemKey,
          target_user_id: null,
          effect_payload: effectPayload,
          accept_blessing_cost: isBlessing,
          consume_candle_of_mercy: isBlessing && consumeCandle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Use failed.');
      }
      await loadSelfItems();
      await refreshSelfEffects();
      await refreshMercyInventory();
      return true;
    } catch (err) {
      const message = err?.message || 'Use failed.';
      if (String(message).toLowerCase().includes('final day of the cycle')) {
        setShowBlessingCandleModal(false);
        setShowBlessingCostModal(false);
        setPendingBlessingItemKey('');
        setShowSelfItemsModal(false);
        alert("You can't use items on the last day of the cycle.");
      }
      setSelfItemsError(message);
      return false;
    } finally {
      setSelfUseBusy('');
    }
  }, [selfUseBusy, selfItemByKey, buildSelfEffectPayload, token, campaignId, loadSelfItems, refreshSelfEffects, refreshMercyInventory]);

  const handleUseSelfItem = async (itemKey) => {
    const item = selfItemByKey.get(itemKey);
    if (!item || selfUseBusy) return;
    if (item.key === 'candle_of_mercy') {
      setSelfItemsError('Candle of Mercy is only available through retroactive confirmation prompts.');
      return;
    }
    if (item.category === 'blessing') {
      const effectPayload = buildSelfEffectPayload(itemKey, item);
      if (item.payload_type && !effectPayload) return;
      setPendingBlessingItemKey(itemKey);
      setShowBlessingCandleModal(false);
      setShowBlessingCostModal(true);
      return;
    }
    await executeSelfItemUse(itemKey, { consumeCandle: false });
  };

  const handleBlessingSacrifice = async () => {
    if (!pendingBlessingItemKey) return;
    const ok = await executeSelfItemUse(pendingBlessingItemKey, { consumeCandle: false });
    if (ok) {
      setShowBlessingCostModal(false);
      setShowBlessingCandleModal(false);
      setPendingBlessingItemKey('');
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
    if (!pendingBlessingItemKey) return;
    const ok = await executeSelfItemUse(pendingBlessingItemKey, { consumeCandle: true });
    if (ok) {
      setShowBlessingCandleModal(false);
      setShowBlessingCostModal(false);
      setPendingBlessingItemKey('');
    }
  };

  useEffect(() => {
    if (loading) return;

    const searchParams = new URLSearchParams(location.search);
    const urlCampaignId = searchParams.get("campaign_id");
    const rawId = urlCampaignId;

    if (!rawId) {
      navigate("/home");
      return;
    }

    const id = parseInt(rawId);
    if (lastCampaignIdRef.current !== id) {
      setSelectedDay(null);
      lastCampaignIdRef.current = id;
    }
    setCampaignId(id);

  }, [loading, location.search, navigate]); // ✅ add navigate


  useEffect(() => {
    if (!campaignId || !user || loading) return;

    const resetAndFetch = async () => {
      setLoadingDay(true);
      setHintScroll(null);
      setTargetEffects([]);
      setCurseDispersed(false);
      setConeTurnsLeft(0);
      setTimeStopRevealRow(null);
      setTimeStopRevealedCount(5);
      setStatusEffects([]);
      setHintPlaced(false);
      setTwinFatesPlaced(false);
      setGuesses(EMPTY_GRID);
    setResults(Array(6).fill(null));
    setCurrentRow(0);
    setCurrentCol(0);
    setGameOver(false);
    setLetterStatus({});
    setShowTroopModal(false);
    setTroopsEarned(0);
      setDailyWord("");
      setHasOfferedDoubleDown(false);
      setPendingDoubleDownPrompt(false);
      setShowDoubleDownModal(false);

      const dayRes = await fetch(`${API_BASE}/api/campaign/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      const campaignDay = await dayRes.json();
      setCampaignDay(campaignDay);
      setRulerTitle(campaignDay?.ruler_title || 'Current Ruler');
      const dayToLoad = selectedDay ?? campaignDay?.day;
      if (selectedDay === null && dayToLoad) {
        setSelectedDay(dayToLoad);
      }

      // Weekly reward: if this is Day 1 and the current ruler has a pending selection, block play until chosen.
      if (dayToLoad === 1) {
        try {
          const rewardRes = await fetch(`${API_BASE}/api/campaign/rewards/pending`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ campaign_id: campaignId }),
          });
          const rewardData = await rewardRes.json();
          if (rewardData?.pending) {
            setWeeklyReward(rewardData);
            setWeeklyRecipients([]);
            setWeeklyRewardError('');
            setShowWeeklyRewardModal(true);
          } else {
            setShowWeeklyRewardModal(false);
            setWeeklyReward(null);
          }
        } catch (e) {
          // Don't hard-fail the whole screen if reward check fails.
        }
      }

      const stateRes = await fetch(`${API_BASE}/api/game/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId, day: dayToLoad }),
      });
    const progress = await stateRes.json();
      const memberRes = await fetch(`${API_BASE}/api/campaign/self_member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const doubleDownRes = await fetch(`${API_BASE}/api/campaign/self_member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const hintRes = await fetch(`${API_BASE}/api/campaign/items/hint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const effectsRes = await fetch(`${API_BASE}/api/campaign/items/active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const statusRes = await fetch(`${API_BASE}/api/campaign/items/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const doubleDownData = await doubleDownRes.json();
      const hintData = await hintRes.json();
      const effectsData = await effectsRes.json();
      const statusData = await statusRes.json();

        setDoubleDownStatus({
          activated: doubleDownData.double_down_activated === 1,
          usedThisWeek: doubleDownData.double_down_used_week === 1
        });
      if (hintData?.hint?.letter && hintData?.hint?.position && dayToLoad === campaignDay?.day) {
        setHintScroll(hintData.hint);
      } else {
        setHintScroll(null);
      }
        if (effectsData?.effects && dayToLoad === campaignDay?.day) {
          setTargetEffects(effectsData.effects);
          setCurseDispersed(Boolean(effectsData?.curse_dispersed));
          setConeTurnsLeft(getConeTurns(effectsData.effects));
        } else {
          setTargetEffects([]);
          setCurseDispersed(false);
          setConeTurnsLeft(0);
        }
        if (statusData?.effects) {
          setStatusEffects(statusData.effects);
        } else {
          setStatusEffects([]);
        }
      await memberRes.json();

      const validGuesses = Array.isArray(progress.guesses) && progress.guesses.length === 6
  ? progress.guesses.map((row) => normalizeGuessRow(row))
  : EMPTY_GRID;

    setGuesses(validGuesses);

    setResults(Array.isArray(progress.results) ? progress.results : Array(6).fill(null));
    setLetterStatus(typeof progress.letter_status === "object" && progress.letter_status !== null ? progress.letter_status : {});
    setGameOver(typeof progress.game_over === "boolean" ? progress.game_over : false);
    setDailyWord(progress?.word ? String(progress.word).toUpperCase() : "");

    const newRow = typeof progress.current_row === "number" ? progress.current_row : 0;
    setCurrentRow(newRow);

    const guessRow = normalizeGuessRow(validGuesses[newRow]);
    setCurrentCol(getNextEmptyCol(guessRow));

      setLoadingDay(false);
    };

    resetAndFetch();
  }, [campaignId, user, loading, token, selectedDay, adminRefresh]);

  useEffect(() => {
    if (campaignDay?.day && selectedDay === null) {
      setSelectedDay(campaignDay.day);
    }
  }, [campaignDay, selectedDay]);

  const isCurrentDay = selectedDay === campaignDay?.day;
  useEffect(() => {
    if (!isCurrentDay) return;
    const letters = getCartographersLetters(statusEffects);
    if (letters.length === 0) return;

    setLetterStatus((prev) => applyAbsentLetters(prev, letters));
  }, [statusEffects, isCurrentDay]);

  const cartographerLetters = useMemo(
    () => (isCurrentDay ? getCartographersLetters(statusEffects) : []),
    [statusEffects, isCurrentDay]
  );
  const twinFatesInfo = useMemo(() => {
    if (!isCurrentDay) return null;
    const effect = statusEffects.find((entry) => entry.effect_key === "twin_fates");
    if (!effect) return null;
    const letters = Array.isArray(effect?.payload?.letters) ? effect.payload.letters : [];
    const placements = letters
      .map((entry) => {
        const letter = String(entry?.letter || "").toUpperCase();
        const positions = Array.isArray(entry?.positions)
          ? entry.positions.filter((pos) => Number.isInteger(pos))
          : [];
        if (!letter || positions.length === 0) return [];
        return positions.map((position) => ({ letter, position }));
      })
      .flat()
      .filter((entry) => Number.isInteger(entry.position) && entry.position >= 1 && entry.position <= 5);
    const formatted = letters
      .map((entry) => {
        const letter = String(entry?.letter || "").toUpperCase();
        const positions = Array.isArray(entry?.positions)
          ? entry.positions.filter((pos) => Number.isInteger(pos))
          : [];
        if (!letter || positions.length === 0) return null;
        const label = positions.length === 1 ? "position" : "positions";
        return `Letter ${letter} in ${label} ${positions.join(", ")}`;
      })
      .filter(Boolean);
    const hasDoubles = formatted.length > 0;
    return {
      hasDoubles,
      detail: hasDoubles ? formatted.join(" & ") : "No double letters found.",
      placements,
    };
  }, [statusEffects, isCurrentDay]);
  const easyTongueCount = useMemo(() => {
    if (!isCurrentDay) return null;
    const effect = statusEffects.find((entry) => entry.effect_key === "vowel_vision");
    const count = effect?.payload?.vowel_count;
    return Number.isInteger(count) ? count : null;
  }, [statusEffects, isCurrentDay]);

  useEffect(() => {
    if (!hintScroll?.letter || !isCurrentDay) return;
    setLetterStatus((prev) => applyOracleCorrectLetter(prev, hintScroll.letter));
  }, [hintScroll, isCurrentDay]);

  useEffect(() => {
    if (!hintScroll?.letter || hintPlaced || !isCurrentDay) return;
    const placement = getOraclePlacement(guesses, currentRow, hintScroll);
    if (!placement) return;

    setGuesses((prev) => {
      const next = prev.map((row) => [...row]);
      if (!next[placement.rowIndex]) return prev;
      next[placement.rowIndex][placement.colIndex] = placement.letter;
      return next;
    });
    setHintPlaced(true);
  }, [hintScroll, hintPlaced, currentRow, guesses, isCurrentDay]);
  const getTargetPayload = useCallback(
    (key) => targetEffects.find((entry) => entry.item_key === key)?.details?.payload?.value || null,
    [targetEffects]
  );
  const edictEffectEntry = useMemo(
    () => (isCurrentDay ? targetEffects.find((entry) => FORCED_UTTERANCE_KEYS.has(entry?.item_key)) : null),
    [isCurrentDay, targetEffects]
  );
  const edictWord = edictEffectEntry?.details?.payload?.value || null;
  const hasForcedUtteranceActive = Boolean(isCurrentDay && edictWord);
  const voodooVowels = isCurrentDay ? getTargetPayload("vowel_voodoo") : null;
  const cleavedConsonants = isCurrentDay ? getTargetPayload("consonant_cleaver") : null;
  const obscuredSightSide = useMemo(() => {
    if (!isCurrentDay) return null;
    const raw = getTargetPayload("blinding_brew");
    if (!raw) return null;
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === "left" || normalized === "right") return normalized;
    return null;
  }, [isCurrentDay, getTargetPayload]);
  const activeCurseInfo = useMemo(() => {
    if (!isCurrentDay || !Array.isArray(targetEffects)) return null;
    const curseEntry = targetEffects.find((entry) => CURSE_DETAILS_BY_KEY[entry?.item_key]);
    if (!curseEntry) return null;
    const payloadValue = curseEntry?.details?.payload?.value ?? null;
    const curseConfig = CURSE_DETAILS_BY_KEY[curseEntry.item_key];
    const curseEffectText = curseConfig.describe(payloadValue);
    const effectParts = getCurseEffectParts(curseEntry.item_key, payloadValue, curseEffectText);
    return {
      senderName: curseEntry?.details?.sender_name || 'Unknown attacker',
      curseName: curseConfig.name,
      curseEffect: curseEffectText,
      curseEffectPrefix: effectParts.prefix,
      curseEffectEmphasis: effectParts.emphasis,
      curseEffectSuffix: effectParts.suffix,
    };
  }, [isCurrentDay, targetEffects]);
  const isCursed = Boolean(activeCurseInfo);

  useEffect(() => {
    if (!isCurrentDay || !edictWord) return;
    const row0 = guesses[0] || [];
    const hasLetters = row0.some((letter) => letter);
    const hasResults = Array.isArray(results[0]) && results[0].some((cell) => cell);
    if (hasLetters || !hasResults) return;
    setGuesses((prev) => {
      const next = prev.map((row) => [...row]);
      next[0] = toFiveLetterRow(edictWord);
      return next;
    });
  }, [edictWord, isCurrentDay, guesses, results]);

  useEffect(() => {
    setEdictApplied(false);
  }, [campaignId, selectedDay, edictWord]);

  const isRuler = campaignDay?.ruler_id && user?.user_id === campaignDay.ruler_id;
  const isAdmin = Boolean(user?.is_admin);
  const jesterDance = useJesterDance(targetEffects);
  const spiderSwarm = useSpiderSwarm(targetEffects);
  const canGoBack = selectedDay && selectedDay > 1;
  const canGoForward = selectedDay && campaignDay?.day && selectedDay < campaignDay.day;
  const baseMaxRows = 6;
  let maxVisibleRows = baseMaxRows;
  const hasExecutioner = isCurrentDay && hasExecutionersCut(targetEffects);
  const timeStopActive = isCurrentDay && hasTimeStop(targetEffects) && !gameOver;
  if (hasExecutioner) {
    maxVisibleRows = Math.max(1, maxVisibleRows - 1);
  }
  const executionerRow = hasExecutioner ? Math.max(0, baseMaxRows - 1) : null;
  const voodooActive = Boolean(voodooVowels) && currentRow < 2 && !gameOver;
  const cleaverActive = Boolean(cleavedConsonants) && currentRow < 2 && !gameOver;
  const obscuredSightActive = Boolean(obscuredSightSide) && currentRow < 2 && !gameOver;
  const blockedLetters = useMemo(() => {
    const set = new Set();
    if (voodooActive && voodooVowels) {
      String(voodooVowels).split("").forEach((letter) => set.add(letter.toLowerCase()));
    }
    if (cleaverActive && cleavedConsonants) {
      String(cleavedConsonants).split("").forEach((letter) => set.add(letter.toLowerCase()));
    }
    return set;
  }, [voodooActive, voodooVowels, cleaverActive, cleavedConsonants]);
  const infernalActive = isCurrentDay && targetEffects.some((entry) => entry.item_key === "infernal_mandate");
  const infernalLockedPositions = useMemo(() => {
    if (!infernalActive || currentRow <= 0) return new Map();
    const locked = new Map();
    for (let rowIndex = 0; rowIndex < currentRow; rowIndex += 1) {
      const priorGuess = guesses[rowIndex];
      const priorResult = results[rowIndex];
      if (!Array.isArray(priorGuess) || !Array.isArray(priorResult)) continue;
      for (let idx = 0; idx < 5; idx += 1) {
        if (priorResult[idx] !== "correct") continue;
        const letter = String(priorGuess[idx] || "").toUpperCase();
        if (letter) locked.set(idx, letter);
      }
    }
    return locked;
  }, [infernalActive, currentRow, guesses, results]);

  const findPrevEditableCol = useCallback((rowLetters, startIndex) => {
    for (let idx = startIndex; idx >= 0; idx -= 1) {
      if (!infernalLockedPositions.has(idx) && rowLetters[idx]) return idx;
    }
    return -1;
  }, [infernalLockedPositions]);

  const findNextEditableCol = useCallback((rowLetters, startIndex) => {
    for (let idx = startIndex; idx < 5; idx += 1) {
      if (!infernalLockedPositions.has(idx) && !rowLetters[idx]) return idx;
    }
    return 5;
  }, [infernalLockedPositions]);

  useEffect(() => {
    if (!isCurrentDay || !twinFatesInfo?.hasDoubles || twinFatesPlaced || gameOver) return;
    const row = guesses[currentRow];
    if (!Array.isArray(row) || row.length !== 5) return;

    const nextRow = [...row];
    let changed = false;
    twinFatesInfo.placements.forEach(({ letter, position }) => {
      const colIndex = Number(position) - 1;
      if (colIndex < 0 || colIndex > 4) return;
      if (nextRow[colIndex] !== letter) {
        nextRow[colIndex] = letter;
        changed = true;
      }
    });

    if (!changed) {
      setTwinFatesPlaced(true);
      return;
    }

    setGuesses((prev) => {
      const next = prev.map((guessRow) => [...guessRow]);
      next[currentRow] = nextRow;
      return next;
    });
    setCurrentCol(findNextEditableCol(nextRow, 0));
    setTwinFatesPlaced(true);
  }, [isCurrentDay, twinFatesInfo, twinFatesPlaced, gameOver, guesses, currentRow, findNextEditableCol]);

  useEffect(() => {
    if (!infernalActive || currentRow <= 0 || gameOver) return;
    const activeRow = guesses[currentRow];
    if (!Array.isArray(activeRow) || activeRow.length !== 5) return;
    const nextRow = [...activeRow];
    let changed = false;
    infernalLockedPositions.forEach((letter, idx) => {
      if (nextRow[idx] !== letter) {
        nextRow[idx] = letter;
        changed = true;
      }
    });
    if (changed) {
      setGuesses((prev) => {
        const next = prev.map((row) => [...row]);
        next[currentRow] = nextRow;
        return next;
      });
    }
    const nextCol = findNextEditableCol(nextRow, Math.max(0, currentCol));
    if (nextCol !== currentCol) {
      setCurrentCol(nextCol);
    }
  }, [infernalActive, infernalLockedPositions, currentRow, gameOver, guesses, currentCol, findNextEditableCol]);

  const handleEditRulerTitle = () => {
    setShowRulerModal(true);
  };

  const handleSaveRulerTitle = async (nextTitle) => {
    try {
      const res = await fetch(`${API_BASE}/api/campaign/ruler_title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: Number(campaignId), title: nextTitle })
      });
      if (res.ok) {
        const data = await res.json();
        setRulerTitle(data.ruler_title);
        setShowRulerModal(false);
      }
    } catch {}
  };

  const handleRedeemMercy = async () => {
    if (mercyBusy) return;
    setMercyBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/campaign/items/mercy/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Failed to redeem Candle of Mercy");
      }
      setMercyBonus(Number(data?.bonus ?? 10));
      setStatusEffects((prev) => prev.filter((entry) => entry.effect_key !== "candle_of_mercy"));
      await refreshSelfEffects();
      await refreshMercyInventory();
      setShowMercyModal(true);
    } catch (err) {
      console.error("Mercy redemption failed:", err);
      alert(err?.message || "Failed to redeem Candle of Mercy");
    } finally {
      setMercyBusy(false);
    }
  };

  const openAdminModal = () => setShowAdminModal(true);

  const checkIfCampaignShouldEnd = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/campaign/finished_today`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ campaign_id: campaignId }),
    });

    const data = await res.json();
    if (data.ended) {
      setCampaignEnded(true);
    }
  }, [campaignId, token, refreshMercyInventory]);

  useEffect(() => {
    const interval = setInterval(() => {
      const isFinalDay = isFinalCampaignDay(campaignDay);
      const newCutoffCountdown = getTimeUntilCutoffCT();
      const newMidnightCountdown = getTimeUntilMidnightCT();

      if (
        isFinalDay &&
        newCutoffCountdown.hours === 0 &&
        newCutoffCountdown.minutes === 0 &&
        newCutoffCountdown.seconds === 0 &&
        !campaignEnded
      ) {
        setCampaignEnded(true);
      }

      if (
        newMidnightCountdown.hours === 0 &&
        newMidnightCountdown.minutes === 0 &&
        newMidnightCountdown.seconds === 0
      ) {
        if (isFinalDay) {
          try {
            fetch(`${API_BASE}/api/campaign/end`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ campaign_id: campaignId }),
            });
          } catch (err) {
            console.error("Failed to end campaign:", err);
          }
        }
        window.location.reload();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [campaignDay, campaignId, campaignEnded, token]);

  useEffect(() => {
    if (!isFinalCampaignDay(campaignDay) || campaignEnded) return;
    const interval = setInterval(() => {
      checkIfCampaignShouldEnd();
    }, 30000);

    return () => clearInterval(interval);
  }, [campaignDay, campaignEnded, checkIfCampaignShouldEnd]);


  function generateBattleShareText(guesses, results, campaignDay) {
    const board = guesses
      .map((guess, rowIndex) => {
        if (!results[rowIndex]) return "";
        return results[rowIndex].map(r => {
          if (r === "correct") return "🟢";  // dark green
          if (r === "present") return "🟧";  // orange
          return "⬛";
        }).join("");
      })
      .filter(Boolean)
      .join("\n");

      const nameLine = campaignDay?.name
      ? `🏰 B4W: ${campaignDay.name}`
      : `🏰 Battle for Wordle`;

    const solvedRow = results.findIndex(r => r?.every(cell => cell === "correct"));
    const didSolve = solvedRow !== -1;

    const didDoubleDown = doubleDownStatus.activated;
    const resultLine = didSolve
      ? (didDoubleDown
          ? `⚔️ Double Down Victory`
          : `⚔️ Solved in ${solvedRow + 1}/6`)
      : (didDoubleDown
          ? `💀 Double Down Defeat`
          : `❌ Failed - Disappointment to their Ruler`);

    return `${nameLine}\n${resultLine}\n\n${board}`;
  }



//function to submit the guess
  // This function will be called when the user presses Enter
  // It will send the current guess to the server and update the results
const submitGuess = useCallback(async (forcedGuess = null) => {
  // Double Down no longer changes the number of attempts. (Still respect Executioner's Cut.)
  const baseAttempts = 6;
  const maxAttempts = hasExecutioner ? Math.max(1, baseAttempts - 1) : baseAttempts;
  if (isSubmitting || currentRow >= maxAttempts || gameOver) return;

  const activeRow = normalizeGuessRow(guesses[currentRow]);
  const guess = (forcedGuess ?? activeRow.join("")).toLowerCase();
  const campaign_id = campaignId;
  const user_id = user?.user_id;

  if (!user_id || !campaign_id || guess.length !== 5) {
    return;
  }

  if (forcedGuess) {
    const forcedLetters = toFiveLetterRow(guess);
    setGuesses((prev) => {
      const next = prev.map((row) => [...row]);
      next[currentRow] = forcedLetters;
      return next;
    });
    setCurrentCol(5);
  }

  // 🔒 Client-side duplicate guard (prevents local double-entry)
  const prevWords = guesses
    .slice(0, currentRow)
    .map((row) => normalizeGuessRow(row).join("").toLowerCase());
  if (prevWords.includes(guess)) {
    setErrorMsg("⚠️ You already tried that word.");
    triggerShake();
    setTimeout(() => setErrorMsg(null), 2000);
    return;
  }

  setIsSubmitting(true);
  try {
    const res = await fetch(`${API_BASE}/api/guess`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ word: guess, campaign_id, day: selectedDay }),
    });

    if (res.status === 204) {
      setErrorMsg("❌ Not a valid word");
      triggerShake();
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const data = await res.json();

    // 🛡️ Server-side duplicate guard (idempotent path)
    if (data.duplicate) {
      setErrorMsg("⚠️ You already tried that word.");
      triggerShake();
      setTimeout(() => setErrorMsg(null), 2000);
      return;
    }

    if (!res.ok) {
      const detail = data?.detail;
      const detailMessage = typeof detail === "string" ? detail : detail?.message;
      const infernalPenalty = Number(
        (detail && typeof detail === "object" ? detail.infernal_penalty_applied : undefined)
        ?? data?.infernal_penalty_applied
        ?? 0
      );
      const infernalRuleBroken = Boolean(
        (detail && typeof detail === "object" ? detail.infernal_rule_broken : undefined)
        ?? data?.infernal_rule_broken
      );
      const infernalViolation = String(
        (detail && typeof detail === "object" ? detail.infernal_violation_type : undefined)
        ?? data?.infernal_violation_type
        ?? (detailMessage === "Invalid word" ? "playable_word" : "letters")
      ).toLowerCase();
      if (infernalRuleBroken || infernalPenalty > 0) {
        setInfernalPenaltyAmount(infernalPenalty);
        setInfernalViolationType(infernalViolation === "playable_word" ? "playable_word" : "letters");
        setShowInfernalModal(true);
      }
      if (detailMessage === "Invalid word") {
        setErrorMsg("❌ Not a valid word");
        triggerShake();
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      throw new Error(detailMessage || "Unknown error");
    }

    // --- Reveal flow ---
    const newResults = [...results];
    const revealMultiplier = timeStopActive ? 10 : 1;
    const perTileDelayMs = Math.max(1, Math.floor((TIME_STOP_REVEAL_DELAY_MS * revealMultiplier) / 5));
    const revealedRow = Array(5).fill(null);
    newResults[currentRow] = revealedRow;
    setResults([...newResults]);
    setTimeStopRevealRow(currentRow);
    setTimeStopRevealedCount(0);
    for (let idx = 0; idx < 5; idx += 1) {
      await new Promise((resolve) => setTimeout(resolve, perTileDelayMs));
      revealedRow[idx] = data.result[idx];
      setResults((prev) => {
        const next = [...prev];
        next[currentRow] = [...revealedRow];
        return next;
      });
      setTimeStopRevealedCount(idx + 1);
    }
    setTimeStopRevealRow(null);
    setTimeStopRevealedCount(5);

    const newStatus = { ...letterStatus };
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i].toLowerCase();
      const r = data.result[i];
      const current = newStatus[letter];

      if (r === "correct") newStatus[letter] = "correct";
      else if (r === "present" && current !== "correct") newStatus[letter] = "present";
      else if (!current) newStatus[letter] = "absent";
    }
    setLetterStatus(newStatus);

    const infernalPenalty = Number(data?.infernal_penalty_applied || 0);
    const infernalRuleBroken = Boolean(data?.infernal_rule_broken);
    const infernalViolation = String(data?.infernal_violation_type || "letters").toLowerCase();
    if (infernalRuleBroken || infernalPenalty > 0) {
      setInfernalPenaltyAmount(infernalPenalty);
      setInfernalViolationType(infernalViolation === "playable_word" ? "playable_word" : "letters");
      setShowInfernalModal(true);
    }

    if (data.clown_triggered) {
      triggerClown();
    }

    if (data.result.every(r => r === "correct")) {
      setGameOver(true);
      if (data.word) {
        setDailyWord(String(data.word).toUpperCase());
      }

      let baseTroops = [150, 100, 60, 40, 30, 10][currentRow];
      const awardedTroops = doubleDownStatus.activated ? baseTroops * 2 : baseTroops;

      if (currentRow <= 2) {
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
      }

      setTroopsEarned(awardedTroops);
      setShowTroopModal(true);

      if (isFinalCampaignDay(campaignDay) && selectedDay === campaignDay?.day) {
        await checkIfCampaignShouldEnd();
      }
      return;
    }

    if (coneTurnsLeft > 0) {
      setConeTurnsLeft((prev) => decrementConeTurns(prev));
    }

    if (currentRow + 1 === maxAttempts) {
      setGameOver(true);
      setFailedWord(data.word.toUpperCase());
      setDailyWord(data.word.toUpperCase());
      setTimeout(() => setShowFailureModal(true), 300);
      return;
    }

    // Advance to next row
    const nextRowIndex = currentRow + 1;
    let nextRowTemplate = null;
    if (infernalActive && nextRowIndex < maxAttempts) {
      const nextLocked = new Map(infernalLockedPositions);
      for (let idx = 0; idx < 5; idx += 1) {
        if (data.result[idx] === "correct") {
          nextLocked.set(idx, guess[idx].toUpperCase());
        }
      }
      nextRowTemplate = [...(guesses[nextRowIndex] || Array(5).fill(""))];
      nextLocked.forEach((letter, idx) => {
        nextRowTemplate[idx] = letter;
      });
      setGuesses((prev) => {
        const next = prev.map((row) => [...row]);
        next[nextRowIndex] = nextRowTemplate;
        return next;
      });
    }
    setCurrentRow(nextRowIndex);
    const doubleDownPromptRow = hasForcedUtteranceActive ? 2 : 1;
    if (
      doubleDownEligible &&
      !hasOfferedDoubleDown &&
      nextRowIndex === doubleDownPromptRow
    ) {
      setPendingDoubleDownPrompt(true);
    }
    if (infernalActive && nextRowIndex < maxAttempts) {
      setCurrentCol(findNextEditableCol(nextRowTemplate || Array(5).fill(""), 0));
    } else {
      setCurrentCol(0);
    }
  } catch (err) {
    console.error("Guess submission failed:", err);
    alert("⚠️ Failed to submit guess. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
}, [
  doubleDownStatus,
  doubleDownEligible,
  hasExecutioner,
  isSubmitting,
  currentRow,
  gameOver,
  campaignId,
  user?.user_id,
  guesses,
  selectedDay,
  token,
  results,
  letterStatus,
  triggerShake,
  triggerClown,
  coneTurnsLeft,
  infernalActive,
  infernalLockedPositions,
  findNextEditableCol,
  hasForcedUtteranceActive,
  hasOfferedDoubleDown,
  timeStopActive,
  campaignDay,
  checkIfCampaignShouldEnd,
]);

  useEffect(() => {
    if (!pendingDoubleDownPrompt) return;
    if (!isCurrentDay || loadingDay || gameOver || showDoubleDownModal) return;
    if (!doubleDownEligible || hasOfferedDoubleDown) {
      setPendingDoubleDownPrompt(false);
      return;
    }
    const timer = setTimeout(() => {
      setHasOfferedDoubleDown(true);
      setPendingDoubleDownPrompt(false);
      setShowDoubleDownModal(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [
    pendingDoubleDownPrompt,
    isCurrentDay,
    loadingDay,
    gameOver,
    showDoubleDownModal,
    doubleDownEligible,
    hasOfferedDoubleDown,
  ]);

  useEffect(() => {
    if (!edictWord || !isCurrentDay || gameOver || isSubmitting || edictApplied) return;
    if (currentRow !== 0) {
      setEdictApplied(true);
      return;
    }
    const rowHasLetters = guesses[0]?.some((letter) => letter);
    const rowHasResult = Boolean(results[0]);
    if (rowHasLetters || rowHasResult) {
      setEdictApplied(true);
      return;
    }
    setEdictApplied(true);
    submitGuess(edictWord);
  }, [edictWord, isCurrentDay, gameOver, isSubmitting, edictApplied, currentRow, guesses, results, submitGuess]);

  const handleKeyPress = useCallback((key) => {
    if (showWeeklyRewardModal) return;
    if (gameOver || campaignEnded || loadingDay || isSubmitting) return;

    // Clear error on any input
    if (errorMsg) setErrorMsg(null);

    if (key === '⌫') {
      const rowLetters = normalizeGuessRow(guesses[currentRow]);
      const prevCol = findPrevEditableCol(rowLetters, currentCol - 1);
      if (prevCol >= 0) {
        rowLetters[prevCol] = "";
        const newGuesses = [...guesses];
        newGuesses[currentRow] = rowLetters;
        setGuesses(newGuesses);
        setCurrentCol(prevCol);
      }
    } else if (key === 'Enter') {
  if (currentCol === 5 && !isSubmitting) {
    submitGuess();
  }
    } else {
      const lowerKey = key.toLowerCase();
      if (blockedLetters.has(lowerKey)) {
        setErrorMsg("That letter is hexed.");
        triggerShake();
        setTimeout(() => setErrorMsg(null), 2000);
        return;
      }
      const rowLetters = normalizeGuessRow(guesses[currentRow]);
      let targetCol = currentCol;
      if (infernalActive && currentRow > 0) {
        targetCol = findNextEditableCol(rowLetters, currentCol);
      }
      if (targetCol < 5) {
        const newGuesses = [...guesses];
        rowLetters[targetCol] = key;
        newGuesses[currentRow] = rowLetters;
        setGuesses(newGuesses);
        setCurrentCol(findNextEditableCol(rowLetters, targetCol + 1));
      }
    }
  }, [
    showWeeklyRewardModal,
    gameOver,
    campaignEnded,
    loadingDay,
    isSubmitting,
    errorMsg,
    currentCol,
    currentRow,
    guesses,
    infernalActive,
    findNextEditableCol,
    findPrevEditableCol,
    blockedLetters,
    triggerShake,
    submitGuess,
  ]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        handleKeyPress("Enter");
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        handleKeyPress("⌫");
        return;
      }
      if (/^[a-zA-Z]$/.test(event.key)) {
        handleKeyPress(event.key.toUpperCase());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyPress]);


  const isAdminCampaign = Boolean(campaignDay?.is_admin_campaign);
  const canRedeemMercy = mercyInventoryCount > 0 || (isAdmin && isAdminCampaign);

  const rulerBackgroundStyle = campaignDay?.ruler_background_image_url
    ? {
        backgroundImage: `url(${campaignDay.ruler_background_image_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }
    : undefined;

  return (
    <div
      className="game-wrapper"
      style={rulerBackgroundStyle}
    >
      <div className="game-content">
        <div className="game-inner">
          <div className="game-top-row">
            <div className="camp-menu game-top-half" ref={campMenuRef}>
              <div className="camp-menu-card">
                <button
                  className="back-btn camp-menu-button camp-menu-use"
                  onClick={openSelfItemsModal}
                  type="button"
                >
                  Use Items
                </button>
                <button
                  className="back-btn camp-menu-button camp-menu-travel"
                  onClick={() => setShowCampMenu((prev) => !prev)}
                  type="button"
                >
                  Travel ▾
                </button>
              </div>
              {showCampMenu && (
                <div className="camp-menu-list">
                  <button
                    className="camp-menu-item"
                    onClick={() => {
                      setShowCampMenu(false);
                      navigate(`/leaderboard/${campaignId}`);
                    }}
                    type="button"
                  >
                    Leaderboard 🏆
                  </button>
                  <button
                    className="camp-menu-item"
                    onClick={() => {
                      setShowCampMenu(false);
                      if (campaignId) {
                        navigate(`/campaign/${campaignId}`);
                      } else {
                        navigate('/campaigns');
                      }
                    }}
                    type="button"
                  >
                    Basecamp ⛺
                  </button>
                  <button
                    className="camp-menu-item"
                    onClick={() => {
                      setShowCampMenu(false);
                      if (campaignId) {
                        navigate(`/campaign/${campaignId}/market`);
                      }
                    }}
                    type="button"
                  >
                    Market 💰
                  </button>
                </div>
              )}
            </div>
            <div className="game-king-stack game-top-half" aria-live="polite">
              <section className="game-king-banner">
                <div className="game-king-text">
                  <div className="game-king-title">{rulerTitle}</div>
                  {(() => {
                    const rulerName = campaignDay?.king || 'Uncrowned';
                    const isLong = rulerName.length > 16;
                    const isLonger = rulerName.length > 24;
                    const nameClass = `game-king-name${isLong ? ' long' : ''}${isLonger ? ' longer' : ''}`;
                    return <div className={nameClass}>{rulerName}</div>;
                  })()}
                </div>
                <div className="game-king-glow" aria-hidden="true" />
              </section>
              {(isRuler || isAdmin) && (
                <button
                  className="game-king-edit game-king-edit-bubble"
                  onClick={handleEditRulerTitle}
                  type="button"
                  aria-label="Royal orders"
                  title="Royal Orders"
                >
                  Royal Orders
                </button>
              )}
            </div>
            {isAdmin && isAdminCampaign && (
              <button
                className="admin-btn game-top-half"
                onClick={openAdminModal}
                type="button"
              >
                🛠 Admin
              </button>
            )}
        <RulerTitleModal
          visible={showRulerModal}
          initialTitle={rulerTitle}
          onSave={handleSaveRulerTitle}
          onClose={() => setShowRulerModal(false)}
        />
          </div>
          <div className="game-day-carousel">
            <button
              className="day-arrow"
              type="button"
              onClick={() => canGoBack && setSelectedDay(selectedDay - 1)}
              disabled={!canGoBack}
              aria-label="Previous day"
            >
              ‹
            </button>
            <div className="day-center">
              <div className="day-label">
                Day {selectedDay || campaignDay?.day || 1} of {campaignDay?.total || '?'}
              </div>
            </div>
            <button
              className="day-info-btn"
              type="button"
              aria-label="Day replay info"
              onClick={() => setShowDayReplayInfo(true)}
            >
              i
            </button>
            <button
              className="day-arrow"
              type="button"
              onClick={() => canGoForward && setSelectedDay(selectedDay + 1)}
              disabled={!canGoForward}
              aria-label="Next day"
            >
              ›
            </button>
          </div>
          {shouldShowConeOverlay(coneTurnsLeft, gameOver) && (
            <div
              className="cone-overlay"
              style={{ opacity: getConeOpacity(currentRow, maxVisibleRows) }}
            />
          )}
          <WanderingGlyphOverlay targetEffects={targetEffects} containerRef={playAreaRef} />
          <ClownOverlay show={showClownOverlay} />
          {hintScroll && isCurrentDay && (
            <div className={`game-hint-banner${hintPulse ? " is-fresh" : ""}`}>
              <div className="oracle-hint-title">Oracle's Whisper</div>
              <div className="oracle-hint-detail">
                <span className="oracle-hint-label">Letter</span>{" "}
                <span className="oracle-hint-value">{hintScroll.letter}</span>{" "}
                <span className="oracle-hint-label">in position</span>{" "}
                <span className="oracle-hint-value">{hintScroll.position}</span>
              </div>
            </div>
          )}
          {twinFatesInfo && (
            <div className={`game-effect-banner game-effect-banner-twin ${twinFatesInfo.hasDoubles ? "is-success" : "is-empty"}`}>
              <div className="twin-banner-title">
                <span className="twin-title-x" aria-hidden="true">✕</span>
                <span>Twin Fates</span>
                <span className="twin-title-check" aria-hidden="true">✓</span>
              </div>
              <div className="twin-banner-detail">
                <span className={twinFatesInfo.hasDoubles ? "twin-title-check" : "twin-title-x"} aria-hidden="true">
                  {twinFatesInfo.hasDoubles ? "✓" : "✕"}
                </span>
                <span>{twinFatesInfo.detail}</span>
                <span className={twinFatesInfo.hasDoubles ? "twin-title-check" : "twin-title-x"} aria-hidden="true">
                  {twinFatesInfo.hasDoubles ? "✓" : "✕"}
                </span>
              </div>
            </div>
          )}
          {easyTongueCount !== null && (
            <div className="game-effect-banner game-effect-banner-divine">
              <div className="divine-banner-title">
                <span className="divine-title-star" aria-hidden="true">✦</span>
                <span>God of the Easy Tongue</span>
                <span className="divine-title-star" aria-hidden="true">✦</span>
              </div>
              <div className="divine-banner-detail">
                Today&apos;s word has <strong>{easyTongueCount}</strong> vowel{easyTongueCount === 1 ? '' : 's'}.
              </div>
            </div>
          )}
          <div className={`game-play-area${isCursed ? " cursed-play-area" : ""}${isCursed && curseDispersed ? " cursed-play-area-dispersed" : ""}`} ref={playAreaRef}>
            {isCursed && (
              <button
                className={`curse-hex-button${curseDispersed ? " curse-hex-button-dispersed" : ""}`}
                type="button"
                aria-label="Curse details"
                title="View curse details"
                onClick={() => setShowCurseInfoModal(true)}
              >
                <img src={hexRuneIcon} alt="" className="curse-hex-icon" aria-hidden="true" />
              </button>
            )}
            {spiderSwarm.active && (
              <div className="spider-swarm-layer">
                {spiderSwarm.spiders.map((spider) => (
                  <motion.div
                    key={spider.id}
                    className="spider-swarm-creature"
                    {...getSpiderMotionProps(spider)}
                  />
                ))}
              </div>
            )}
            {loadingDay && (
              <div className="day-loading">
                <div className="day-loading-spinner" />
                <div className="day-loading-text">Loading day…</div>
              </div>
            )}
            {gameOver && !showTroopModal && dailyWord && (
              <div className="share-button-container">
                <div className="share-summary">
                  <div className="share-word">
                    Word of the day: <span className="daily-word-text">{dailyWord}</span>
                  </div>
                  <button
                    className="share-btn share-compact"
                    onClick={() => {
                      const shareText = generateBattleShareText(guesses, results, campaignDay);
                      if (navigator.share) {
                        navigator.share({ text: shareText }).catch((err) => {
                          if (err.name !== "AbortError") {
                            console.error("Share failed:", err);
                          }
                        });
                      } else {
                        navigator.clipboard.writeText(shareText);
                        alert("📋 Copied result to clipboard!");
                      }
                    }}
                  >
                    Share
                  </button>
                </div>
              </div>
            )}
            {/* Re-inserted core game components */}
            <div className={`grid-outer ${shake ? 'shake' : ''}`}>
              <WordGrid
                guesses={guesses}
                results={results}
                currentRow={currentRow}
                currentCol={currentCol}
                maxVisibleRows={maxVisibleRows}
                correctColor={hasBloodOathInk(targetEffects) ? "#8d1e2a" : undefined}
                jesterDance={jesterDance.active}
                jesterSeed={jesterDance.seed}
                getJesterDanceStyle={jesterDance.getStyle}
                edictRow={edictWord ? 0 : null}
                executionerRow={executionerRow}
                obscuredSightSide={obscuredSightSide}
                obscuredSightActive={obscuredSightActive}
                timeStopRevealRow={timeStopRevealRow}
                timeStopRevealedCount={timeStopRevealedCount}
                timeStopRevealActive={timeStopRevealRow !== null}
              />
            </div>
            <Keyboard
              letterStatus={letterStatus}
              onKeyPress={handleKeyPress}
              className={hasBloodOathInk(targetEffects) ? "blood-ink" : ""}
              jesterDance={jesterDance.active}
              jesterSeed={jesterDance.seed}
              getJesterDanceStyle={jesterDance.getStyle}
              sealedLetter={null}
              voidLetters={[]}
              cursedLetters={Array.from(blockedLetters)}
              cartographerLetters={cartographerLetters}
              obscuredSightSide={obscuredSightSide}
              obscuredSightActive={obscuredSightActive}
            />
          </div>
          <DayReplayInfoModal
            visible={showDayReplayInfo}
            onClose={() => setShowDayReplayInfo(false)}
          />
          {showSelfItemsModal && (
            <div className="modal-overlay">
              <div className="modal self-items-modal">
                <div className="self-items-header">
                  <h2>Inventory</h2>
                  <button
                    className="self-items-close"
                    onClick={() => {
                      setShowSelfItemsModal(false);
                      setShowBlessingCostModal(false);
                      setShowBlessingCandleModal(false);
                      setPendingBlessingItemKey('');
                    }}
                    type="button"
                    aria-label="Close inventory"
                  >
                    ✕
                  </button>
                </div>
                <p className="self-items-subtitle">Use items that only affect you.</p>
                {selfItemsError && <div className="self-items-error">{selfItemsError}</div>}
                {selfItemsLoading ? (
                  <div className="self-items-loading">Loading items...</div>
                ) : (
                  <div className="self-items-list">
                    {selfUsableInventory.length === 0 ? (
                      <div className="self-items-empty">No self-use items available.</div>
                    ) : (
                      selfUsableInventory.map((entry) => {
                        const item = selfItemByKey.get(entry.item_key);
                        const payloadType = item?.payload_type;
                        return (
                          <div key={entry.item_key} className="self-items-row">
                            <div className="self-items-row-main">
                              <div className="self-items-name">{item?.name || entry.item_key}</div>
                              <div className="self-items-desc">{item?.description}</div>
                            </div>
                            <div className="self-items-row-actions">
                              <div className="self-items-qty">x{entry.quantity}</div>
                              {payloadType && (
                                <input
                                  className="self-items-input"
                                  value={selfPayloadValues[entry.item_key] || ''}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setSelfPayloadValues((prev) => ({
                                      ...prev,
                                      [entry.item_key]: nextValue,
                                    }));
                                  }}
                                  placeholder={payloadType === 'letter' ? 'Letter' : 'Word'}
                                  maxLength={payloadType === 'letter' ? 1 : 5}
                                />
                              )}
                              <button
                                className="troop-btn"
                                onClick={() => handleUseSelfItem(entry.item_key)}
                                disabled={selfUseBusy === entry.item_key}
                              >
                                {selfUseBusy === entry.item_key ? 'Using...' : 'Use'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <BlessingUseModals
            showCostModal={showBlessingCostModal}
            showCandleModal={showBlessingCandleModal}
            pendingItemName={pendingBlessingItem?.name || ''}
            hasCandleInventory={hasCandleInventory}
            onCloseCost={() => {
              setShowBlessingCostModal(false);
              setPendingBlessingItemKey('');
            }}
            onSacrifice={handleBlessingSacrifice}
            onUseCandle={handleBlessingUseCandle}
            onCandleYes={handleBlessingCandleYes}
            onCandleNo={handleBlessingCandleNo}
          />


        </div>
      </div>
      
      {/* Weekly Winner Reward Modal */}
      <WeeklyRewardModal
        visible={showWeeklyRewardModal && weeklyReward?.pending}
        title="Weekly Reward"
        description={
          weeklyReward?.pending
            ? `You won the last cycle. Pick ${weeklyReward.recipient_count} player${weeklyReward.recipient_count === 1 ? '' : 's'} to receive a bundle of ${weeklyReward.whispers_per_recipient} Oracle's Whisper${weeklyReward.whispers_per_recipient === 1 ? '' : 's'}.`
            : ''
        }
        candidates={weeklyReward?.candidates || []}
        selectedIds={weeklyRecipients}
        requiredCount={weeklyReward?.recipient_count || 0}
        busy={weeklyRewardBusy}
        error={weeklyRewardError}
        confirmLabel="Confirm Picks"
        onToggle={toggleWeeklyRecipient}
        onConfirm={submitWeeklyReward}
        footerNote="You must complete this before you can play Day 1."
      />

{/* Troop Modal */}
      {showTroopModal && (
        <div className="troop-modal-overlay">
          <div className="troop-modal">
            <h2>🎖 Victory!</h2>
            <p>
              You gained <strong>{troopsEarned}</strong> troops
              {doubleDownStatus.activated && <span> with Double Down! ⚔️</span>}
              </p>
            <div className="modal-buttons">
              <button
                className="troop-btn"
                onClick={() => {
                  const shareText = generateBattleShareText(guesses, results, campaignDay);
                  if (navigator.share) {
                    navigator.share({ text: shareText });
                  } else {
                    navigator.clipboard.writeText(shareText);
                    alert("📋 Copied result to clipboard!");
                  }
                }}
              >
                📤 Share
              </button>
              <button className="troop-btn close-btn" onClick={() => setShowTroopModal(false)}>❌ Close</button>
              <button
                className="troop-btn leaderboard-btn"
                onClick={() => {
                  setShowTroopModal(false);
                  navigate(`/leaderboard/${campaignId}`);
                }}
              >
                🏰 Go to Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Display Name Modal */}
      {/* Failure Modal */}
      {showFailureModal && (
          <div className="modal-overlay">
            <div className="modal failure-modal">
              <h2>💀 Thou Hast Failed!</h2>
              <p>
                The sacred word was:
                <strong className='secretWord'> {failedWord}</strong>
              </p>
              <p>
                Alas, the kingdom shall remember thy defeat. Return stronger on the morrow!
              </p>
              <div className="modal-buttons">
                <button className="troop-btn close-btn" onClick={() => setShowFailureModal(false)}>
                   Accept Defeat
                </button>
                {canRedeemMercy && (
                  <button
                    className="troop-btn"
                    onClick={handleRedeemMercy}
                    disabled={mercyBusy}
                    title="Light the Candle of Mercy"
                  >
                    🕯️ Use Candle of Mercy (+10 troops)
                  </button>
                )}
                <button
                  className="troop-btn leaderboard-btn"
                  onClick={() => {
                    setShowFailureModal(false);
                    navigate(`/leaderboard/${campaignId}`);
                  }}
                >
                   View Leaderboard
                </button>
              </div>
            </div>
          </div>
        )}
      {showMercyModal && (
        <div className="modal-overlay">
          <div className="modal troop-modal">
            <h2>🕯️ Candle of Mercy</h2>
            <p className="mercy-excerpt">
              "In the ashes of defeat, the flame yet favors the fallen."
            </p>
            <p>You are rewarded <strong>{mercyBonus}</strong> troops.</p>
            <div className="modal-buttons">
              <button className="troop-btn close-btn" onClick={() => setShowMercyModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showCurseInfoModal && activeCurseInfo && (
        <div className="modal-overlay">
          <div className="modal curse-info-modal">
            <div className="curse-info-header">
              <h2>Hex Mark Detected</h2>
              <button
                className="self-items-close"
                type="button"
                onClick={() => setShowCurseInfoModal(false)}
                aria-label="Close curse details"
              >
                ✕
              </button>
            </div>
            <div className="curse-info-body">
              <p className="curse-info-line curse-info-line-user">
                <span className="curse-info-label">Cursed by:</span>{" "}
                <span className="curse-info-user">{activeCurseInfo.senderName}</span>
              </p>
              <p className="curse-info-line curse-info-line-curse">
                <span className="curse-info-label">Curse:</span>{" "}
                <span className="curse-info-curse-name">{activeCurseInfo.curseName}</span>
              </p>
              <p className="curse-info-line curse-info-line-effect">
                <span className="curse-info-label">Effect:</span>{" "}
                <span>
                  {activeCurseInfo.curseEffectPrefix}
                  {activeCurseInfo.curseEffectEmphasis ? (
                    <span className="curse-info-effect-emphasis">{activeCurseInfo.curseEffectEmphasis}</span>
                  ) : null}
                  {activeCurseInfo.curseEffectSuffix}
                </span>
              </p>
            </div>
            {curseDispersed ? (
              <p className="curse-info-dispersed-note">You may now use blessings.</p>
            ) : (
              <p className="curse-info-warning">While hexed, you may not use blessings.</p>
            )}
            <div className="modal-buttons">
              <button className="troop-btn close-btn" type="button" onClick={() => setShowCurseInfoModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showInfernalModal && (
        <div className="modal-overlay">
          <div className="modal curse-info-modal">
            <div className="curse-info-header">
              <h2>Infernal Mandate</h2>
              <button
                className="self-items-close"
                type="button"
                onClick={() => setShowInfernalModal(false)}
                aria-label="Close infernal warning"
              >
                ✕
              </button>
            </div>
            <div className="curse-info-body">
              {infernalPenaltyAmount > 0 ? (
                <p>
                  You lost <strong>{infernalPenaltyAmount}</strong> troops.
                </p>
              ) : (
                <p>
                  No troops were lost because today&apos;s infernal penalty cap has already been reached.
                </p>
              )}
              <p>
                {infernalViolationType === 'playable_word'
                  ? <>You must play a playable word or risk losing <span className="curse-info-effect-emphasis">5 more troops</span>.</>
                  : <>Use all discovered letters in every guess or risk losing <span className="curse-info-effect-emphasis">5 more troops</span>.</>}
              </p>
              <p>
                Infernal penalties cap at <strong>20</strong> troops per day.
              </p>
            </div>
            <div className="modal-buttons">
              <button className="troop-btn close-btn" type="button" onClick={() => setShowInfernalModal(false)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
      <AdminToolsModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        campaignId={campaignId}
        token={token}
        isAdmin={isAdmin}
        isAdminCampaign={isAdminCampaign}
        onSuccess={() => setAdminRefresh((prev) => prev + 1)}
      />
        <DoubleDownModal
          visible={showDoubleDownModal}
          onAccept={async () => {
            try {
              const res = await fetch(`${API_BASE}/api/double_down`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ campaign_id: campaignId }),
              });

              if (!res.ok) {
                const error = await res.json();
                alert("⚠️ " + (error.detail || "Failed to activate Double Down"));
                return;
              }

              setDoubleDownStatus({
                activated: true,
                usedThisWeek: false
              });
            setShowDoubleDownModal(false);
            } catch (err) {
              console.error("Double Down activation failed:", err);
              alert("⚠️ Failed to activate Double Down");
            }
          }}
          onDecline={() => setShowDoubleDownModal(false)}
        />
    </div>
  );

}
