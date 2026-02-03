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
import {
  applyAbsentLetters,
  getCartographersLetters,
  applyOracleCorrectLetter,
  getOraclePlacement,
  hasCandleOfMercy,
  hasBloodOathInk,
  hasExecutionersCut,
  useClownJumpscare,
  ClownOverlay,
  useSpiderSwarm,
  getSpiderMotionProps,
} from '../components/items/basic';
import {
  useJesterDance,
  getConeTurns,
  decrementConeTurns,
  shouldShowConeOverlay,
  getConeOpacity
} from '../components/items/spells';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

const EMPTY_GRID = Array.from({ length: 6 }, () => Array(5).fill(""));

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
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failedWord, setFailedWord] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [doubleDownStatus, setDoubleDownStatus] = useState({
    activated: false,
    usedThisWeek: false
  });
  const [rulerTitle, setRulerTitle] = useState('Current Ruler');
  const [showRulerModal, setShowRulerModal] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [showDayReplayInfo, setShowDayReplayInfo] = useState(false);
  const [hintScroll, setHintScroll] = useState(null);
  const [hintPulse, setHintPulse] = useState(false);
  const lastHintRef = useRef("");
  const [targetEffects, setTargetEffects] = useState([]);
  const [coneTurnsLeft, setConeTurnsLeft] = useState(0);
  const [statusEffects, setStatusEffects] = useState([]);
  const [hintPlaced, setHintPlaced] = useState(false);
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
  const [selfItemsCatalog, setSelfItemsCatalog] = useState([]);
  const [selfPayloadValues, setSelfPayloadValues] = useState({});
  const [selfUseBusy, setSelfUseBusy] = useState('');

  // Weekly winner reward selection (cycle gate)
  const [weeklyReward, setWeeklyReward] = useState(null);
  const [showWeeklyRewardModal, setShowWeeklyRewardModal] = useState(false);
  const [weeklyRecipients, setWeeklyRecipients] = useState([]);
  const [weeklyRewardBusy, setWeeklyRewardBusy] = useState(false);
  const [weeklyRewardError, setWeeklyRewardError] = useState('');
  const campMenuRef = useRef(null);

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
      return item && !item.requires_target && Number(entry.quantity) > 0;
    })
  ), [selfInventory, selfItemByKey]);

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
    } catch (err) {
      setSelfItemsError(err?.message || 'Failed to load items.');
    } finally {
      setSelfItemsLoading(false);
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
        setConeTurnsLeft(getConeTurns(effectsData.effects));
      } else {
        setTargetEffects([]);
        setConeTurnsLeft(0);
      }

      if (statusData?.effects) {
        setStatusEffects(statusData.effects);
      } else {
        setStatusEffects([]);
      }
    } catch {
      // Silently ignore refresh failures; main gameplay flow still works.
    }
  }, [campaignId, token]);

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

  const handleUseSelfItem = async (itemKey) => {
    if (selfUseBusy) return;
    const item = selfItemByKey.get(itemKey);
    if (item?.payload_type) {
      const rawValue = String(selfPayloadValues[itemKey] || '').trim().toLowerCase();
      if (item.payload_type === 'letter' && (!rawValue || rawValue.length !== 1 || !/^[a-z]$/i.test(rawValue))) {
        setSelfItemsError('Choose a single letter before using this item.');
        return;
      }
      if (item.payload_type === 'word' && (!rawValue || rawValue.length !== 5 || !/^[a-z]{5}$/i.test(rawValue))) {
        setSelfItemsError('Choose a 5-letter word before using this item.');
        return;
      }
    }

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
          effect_payload: item?.payload_type
            ? { value: String(selfPayloadValues[itemKey] || '').trim().toLowerCase() }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Use failed.');
      }
      await loadSelfItems();
      await refreshSelfEffects();
    } catch (err) {
      setSelfItemsError(err?.message || 'Use failed.');
    } finally {
      setSelfUseBusy('');
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
    setCampaignId(id);

  }, [loading, location.search, navigate]); // ✅ add navigate


  useEffect(() => {
    if (!campaignId || !user || loading) return;

    const resetAndFetch = async () => {
      setLoadingDay(true);
      setHintScroll(null);
      setTargetEffects([]);
      setConeTurnsLeft(0);
      setStatusEffects([]);
      setHintPlaced(false);
      setGuesses(EMPTY_GRID);
    setResults(Array(6).fill(null));
    setCurrentRow(0);
    setCurrentCol(0);
    setGameOver(false);
    setLetterStatus({});
    setShowTroopModal(false);
    setTroopsEarned(0);
    setDailyWord("");

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
        const hasEdictEffect = Array.isArray(effectsData?.effects)
          ? effectsData.effects.some((entry) => entry?.item_key === "edict_of_compulsion")
          : false;
        if (effectsData?.effects && dayToLoad === campaignDay?.day) {
          setTargetEffects(effectsData.effects);
          setConeTurnsLeft(getConeTurns(effectsData.effects));
        }
        if (statusData?.effects) {
          setStatusEffects(statusData.effects);
        }

        // 🔒 SHOW ONLY if not used this week, not used today, and eligible to activate
        if (
          doubleDownData.double_down_activated === 1 &&
          !doubleDownData.double_down_used_week &&
          (progress.current_row === 0 || typeof progress.current_row !== "number") &&
          dayToLoad === campaignDay?.day &&
          !hasEdictEffect
        ) {
          setShowDoubleDownModal(true);
        }
      await memberRes.json();

      const validGuesses = Array.isArray(progress.guesses) && progress.guesses.length === 6
  ? progress.guesses.map(row => Array.isArray(row) && row.length === 5 ? row : Array(5).fill(""))
  : EMPTY_GRID;

    setGuesses(validGuesses);

    setResults(Array.isArray(progress.results) ? progress.results : Array(6).fill(null));
    setLetterStatus(typeof progress.letter_status === "object" && progress.letter_status !== null ? progress.letter_status : {});
    setGameOver(typeof progress.game_over === "boolean" ? progress.game_over : false);
    setDailyWord(progress?.word ? String(progress.word).toUpperCase() : "");

    const newRow = typeof progress.current_row === "number" ? progress.current_row : 0;
    setCurrentRow(newRow);

    const guessRow = validGuesses[newRow] || [];
    const nextCol = guessRow.findIndex((l) => l === "");
    setCurrentCol(nextCol === -1 ? 5 : nextCol);

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
  const edictWord = isCurrentDay ? getTargetPayload("edict_of_compulsion") : null;
  const sealedLetter = isCurrentDay ? getTargetPayload("seal_of_silence") : null;
  const voidbrandWord = isCurrentDay ? getTargetPayload("voidbrand") : null;
  const edictSender = isCurrentDay
    ? targetEffects.find((entry) => entry.item_key === "edict_of_compulsion")?.details?.sender_name
    : null;

  useEffect(() => {
    if (!isCurrentDay || !edictWord) return;
    const row0 = guesses[0] || [];
    const hasLetters = row0.some((letter) => letter);
    const hasResults = Array.isArray(results[0]) && results[0].some((cell) => cell);
    if (hasLetters || !hasResults) return;
    setGuesses((prev) => {
      const next = prev.map((row) => [...row]);
      next[0] = String(edictWord).toUpperCase().split("").slice(0, 5);
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
  const baseMaxRows = isCurrentDay && doubleDownStatus.activated ? 3 : 6;
  let maxVisibleRows = baseMaxRows;
  const hasExecutioner = isCurrentDay && hasExecutionersCut(targetEffects);
  if (hasExecutioner) {
    maxVisibleRows = Math.max(1, maxVisibleRows - 1);
  }
  const executionerRow = hasExecutioner ? Math.max(0, baseMaxRows - 1) : null;
  const sealActive = Boolean(sealedLetter) && currentRow < 2 && !gameOver;
  const voidActive = Boolean(voidbrandWord) && currentRow === 0 && !gameOver;
  const blockedLetters = useMemo(() => {
    const set = new Set();
    if (sealActive && sealedLetter) set.add(String(sealedLetter).toLowerCase());
    if (voidActive && voidbrandWord) {
      String(voidbrandWord).split("").forEach((letter) => set.add(letter.toLowerCase()));
    }
    return set;
  }, [sealActive, sealedLetter, voidActive, voidbrandWord]);

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
  }, [campaignId, token]);

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
  const baseAttempts = doubleDownStatus.activated ? 3 : 6;
  const maxAttempts = hasExecutioner ? Math.max(1, baseAttempts - 1) : baseAttempts;
  if (isSubmitting || currentRow >= maxAttempts || gameOver) return;

  const guess = (forcedGuess ?? guesses[currentRow].join("")).toLowerCase();
  const campaign_id = campaignId;
  const user_id = user?.user_id;

  if (!user_id || !campaign_id || guess.length !== 5) {
    return;
  }

  if (forcedGuess) {
    const forcedLetters = guess.toUpperCase().split("");
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
    .map(row => row.join("").toLowerCase());
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
      if (data?.detail === "Invalid word") {
        setErrorMsg("❌ Not a valid word");
        triggerShake();
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      throw new Error(data?.detail || "Unknown error");
    }

    // --- Existing success flow (unchanged) ---
    const newResults = [...results];
    newResults[currentRow] = data.result;
    setResults(newResults);

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

    if (data.clown_triggered) {
      triggerClown();
    }

    if (data.result.every(r => r === "correct")) {
      setGameOver(true);
      if (data.word) {
        setDailyWord(String(data.word).toUpperCase());
      }

      let baseTroops = [150, 100, 60, 40, 30, 10][currentRow];
      const awardedTroops = doubleDownStatus.activated && currentRow <= 2 ? baseTroops * 2 : baseTroops;

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
    setCurrentRow(currentRow + 1);
    const shouldDelayDoubleDown = edictWord && edictApplied;
    const doubleDownRow = shouldDelayDoubleDown ? 1 : 0;
    if (currentRow === doubleDownRow && !doubleDownStatus.activated && !doubleDownStatus.usedThisWeek) {
      setTimeout(() => setShowDoubleDownModal(true), 400);
    }
    setCurrentCol(0);
  } catch (err) {
    console.error("Guess submission failed:", err);
    alert("⚠️ Failed to submit guess. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
}, [
  doubleDownStatus,
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
  edictWord,
  edictApplied,
  campaignDay,
  checkIfCampaignShouldEnd,
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
      if (currentCol > 0) {
        const newGuesses = [...guesses];
        newGuesses[currentRow][currentCol - 1] = "";
        setGuesses(newGuesses);
        setCurrentCol(currentCol - 1);
      }
    } else if (key === 'Enter') {
  if (currentCol === 5 && !isSubmitting) {
    submitGuess();
  }
    } else {
      const lowerKey = key.toLowerCase();
      if (blockedLetters.has(lowerKey)) {
        setErrorMsg(voidActive ? "That letter is voidbranded." : "That letter is sealed.");
        triggerShake();
        setTimeout(() => setErrorMsg(null), 2000);
        return;
      }
      if (currentCol < 5) {
        const newGuesses = [...guesses];
        newGuesses[currentRow][currentCol] = key;
        setGuesses(newGuesses);
        setCurrentCol(currentCol + 1);
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
    blockedLetters,
    voidActive,
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

  const rulerBackgroundStyle = !isAdminCampaign && campaignDay?.ruler_background_image_url
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
      className={`game-wrapper${isAdminCampaign ? " admin-theme" : ""}`}
      style={rulerBackgroundStyle}
    >
      <div className="game-content">
        <div className="game-inner">
          {hasCandleOfMercy(statusEffects) && (
            <div className="game-effect-banner">
              Candle of Mercy: +10 troops if you fail today.
            </div>
          )}
          {voidActive && (
            <div className="game-effect-banner voidbrand-banner">
              Voidbrand: <span className="voidbrand-word">{String(voidbrandWord).toUpperCase()}</span> is forbidden for your first guess.
            </div>
          )}
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
                        navigate(`/campaign/${campaignId}/shop`);
                      }
                    }}
                    type="button"
                  >
                    Shop 💰
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
          token={token}
          campaignId={campaignId}
          rulerBackdropUrl={campaignDay?.ruler_background_image_url || ''}
          onBackdropSaved={(url) => {
            setCampaignDay((prev) => (prev ? { ...prev, ruler_background_image_url: url } : prev));
          }}
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
          <div className="game-play-area">
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
            {shouldShowConeOverlay(coneTurnsLeft, gameOver) && (
              <div
                className="cone-overlay"
                style={{ opacity: getConeOpacity(currentRow, maxVisibleRows) }}
              />
            )}
            <ClownOverlay show={showClownOverlay} />
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
                edictSender={edictSender}
              />
            </div>
            <Keyboard
              letterStatus={letterStatus}
              onKeyPress={handleKeyPress}
              className={hasBloodOathInk(targetEffects) ? "blood-ink" : ""}
              jesterDance={jesterDance.active}
              jesterSeed={jesterDance.seed}
              getJesterDanceStyle={jesterDance.getStyle}
              sealedLetter={sealActive ? sealedLetter : null}
              voidLetters={voidActive && voidbrandWord ? String(voidbrandWord).toUpperCase().split("") : []}
              cartographerLetters={cartographerLetters}
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
                    onClick={() => setShowSelfItemsModal(false)}
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


        </div>
      </div>
      
      {/* Weekly Winner Reward Modal */}
      {showWeeklyRewardModal && weeklyReward?.pending && (
        <div className="troop-modal-overlay">
          <div className="troop-modal">
            <h2>Weekly Reward</h2>
            <p style={{ marginTop: 6 }}>
              You won the last cycle. Pick <b>{weeklyReward.recipient_count}</b> player{weeklyReward.recipient_count === 1 ? '' : 's'} to receive
              a bundle of <b>{weeklyReward.whispers_per_recipient}</b> Oracle&apos;s Whisper{weeklyReward.whispers_per_recipient === 1 ? '' : 's'}.
            </p>

            {weeklyRewardError && (
              <div style={{ color: '#ff7b7b', marginTop: 10 }}>{weeklyRewardError}</div>
            )}

            <div style={{ marginTop: 12, textAlign: 'left', maxHeight: 280, overflowY: 'auto' }}>
              {(weeklyReward.candidates || []).map((c) => (
                <label key={c.user_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
                  <input
                    type="checkbox"
                    checked={weeklyRecipients.includes(c.user_id)}
                    onChange={() => toggleWeeklyRecipient(c.user_id)}
                    disabled={weeklyRewardBusy}
                  />
                  <span>{c.display_name}</span>
                </label>
              ))}
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="troop-btn"
                onClick={submitWeeklyReward}
                disabled={weeklyRewardBusy || weeklyRecipients.length !== (weeklyReward.recipient_count || 0)}
              >
                {weeklyRewardBusy ? 'Saving…' : 'Confirm Picks'}
              </button>
            </div>

            <p style={{ marginTop: 10, opacity: 0.85 }}>
              You must complete this before you can play Day 1.
            </p>
          </div>
        </div>
      )}

      {/* Troop Modal */}
      {showTroopModal && (
        <div className="troop-modal-overlay">
          <div className="troop-modal">
            <h2>🎖 Victory!</h2>
            <p>
              You gained <strong>{troopsEarned}</strong> troops
              {doubleDownStatus.activated && currentRow <= 2 && <span> with Double Down! ⚔️</span>}
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
                {hasCandleOfMercy(statusEffects) && (
                  <button
                    className="troop-btn"
                    onClick={handleRedeemMercy}
                    disabled={mercyBusy}
                    title="Light the Candle of Mercy"
                  >
                    🕯️ Light
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
