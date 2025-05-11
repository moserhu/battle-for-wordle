import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import WordGrid from '../components/WordGrid';
import Keyboard from '../components/Keyboard';
import DoubleDownModal from "../components/DoubleDownModal";
import { useNavigate } from 'react-router-dom';
import '../styles/GameScreen.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLandmark } from "@fortawesome/free-solid-svg-icons";
import confetti from 'canvas-confetti';
import { useAuth } from '../auth/AuthProvider';
import { HslColorPicker } from "react-colorful";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const EMPTY_GRID = Array.from({ length: 6 }, () => Array(5).fill(""));

function getTimeUntilCutoffCT() {
  const now = new Date();
  const nowCT = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const cutoff = new Date(nowCT);
  cutoff.setHours(20, 0, 0, 0); // 8 PM CT
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
  const { user, isAuthenticated, loading } = useAuth();

  const [campaignId, setCampaignId] = useState(null);
  const [guesses, setGuesses] = useState(EMPTY_GRID);
  const [results, setResults] = useState(Array(6).fill(null));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [letterStatus, setLetterStatus] = useState({});
  const [campaignDay, setCampaignDay] = useState(null);
  const [cutoffCountdown, setCutoffCountdown] = useState(getTimeUntilCutoffCT());
  const [midnightCountdown, setMidnightCountdown] = useState(getTimeUntilMidnightCT());
  const [campaignEnded, setCampaignEnded] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showTroopModal, setShowTroopModal] = useState(false);
  const [troopsEarned, setTroopsEarned] = useState(0);
  const [playerDisplayName, setPlayerDisplayName] = useState("");
  const [playerColor, setPlayerColor] = useState("#ffffff");
  const [showEditModal, setShowEditModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(playerDisplayName);
  const [newColor, setNewColor] = useState(playerColor);
  const [showWheel, setShowWheel] = useState(false);
  const [pickerColor, setPickerColor] = useState({ h: 0, s: 1, l: 0.5 });
  const [showDoubleDownModal, setShowDoubleDownModal] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failedWord, setFailedWord] = useState("");
  const [doubleDownStatus, setDoubleDownStatus] = useState({
    activated: false,
    usedThisWeek: false
  });
  
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);
  
  
  useEffect(() => {
    localStorage.removeItem("campaign_ended"); 
    if (loading) return;

    const storedId = localStorage.getItem("campaign_id");
    if (!storedId) {
      navigate("/home");
      return;
    }
  
    const id = parseInt(storedId);
    setCampaignId(id);

    const resetAndFetch = async () => {
      setGuesses(EMPTY_GRID);
      setResults(Array(6).fill(null));
      setCurrentRow(0);
      setCurrentCol(0);
      setGameOver(false);
      setLetterStatus({});
      setShowTroopModal(false);
      setTroopsEarned(0);

      const [dayRes, stateRes] = await Promise.all([
        fetch(`${API_BASE}/api/campaign/progress`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ campaign_id: id }),
        }),
        fetch(`${API_BASE}/api/game/state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ campaign_id: id }), // no need for user_id anymore
        }),              
      ]);

      const campaignDay = await dayRes.json();
      const progress = await stateRes.json();
      setCampaignDay(campaignDay);
      const memberRes = await fetch(`${API_BASE}/api/campaign/self_member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ campaign_id: id }),
      });
      const doubleDownRes = await fetch(`${API_BASE}/api/campaign/self_member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ campaign_id: id }),
      });
      const doubleDownData = await doubleDownRes.json();
      setDoubleDownStatus({
        activated: doubleDownData.double_down_activated === 1,
        usedThisWeek: doubleDownData.double_down_used_week === 1
      });
      if (
        doubleDownData.double_down_activated === 1 &&
        !doubleDownData.double_down_used_week &&
        (progress.current_row === 0 || typeof progress.current_row !== "number")
      ) {
        setShowDoubleDownModal(true);
      }
      
      const self = await memberRes.json();
      setPlayerDisplayName(self.display_name || user.first_name);
      setPlayerColor(self.color || "#ffffff");
      
      localStorage.setItem("invite_code", campaignDay.invite_code);
      localStorage.setItem("campaign_name", campaignDay.name);


      const validGuesses = Array.isArray(progress.guesses) && progress.guesses.length === 6
  ? progress.guesses.map(row => Array.isArray(row) && row.length === 5 ? row : Array(5).fill("")) 
  : EMPTY_GRID;

    setGuesses(validGuesses);
    
    setResults(Array.isArray(progress.results) ? progress.results : Array(6).fill(null));
    setLetterStatus(typeof progress.letter_status === "object" && progress.letter_status !== null ? progress.letter_status : {});
    setGameOver(typeof progress.game_over === "boolean" ? progress.game_over : false);

    const newRow = typeof progress.current_row === "number" ? progress.current_row : 0;
    setCurrentRow(newRow);

    const guessRow = validGuesses[newRow] || [];
    const nextCol = guessRow.findIndex((l) => l === "");
    setCurrentCol(nextCol === -1 ? 5 : nextCol);

    };

    resetAndFetch();
  }, [user, loading, navigate]);
  
  const checkIfCampaignShouldEnd = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/campaign/finished_today`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ campaign_id: campaignId }),
    });
  
    const data = await res.json();
    if (data.ended) {
      localStorage.setItem("campaign_ended", "true");
      setCampaignEnded(true);
    }
  }, [campaignId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const isFinalDay = isFinalCampaignDay(campaignDay);
  
      const newCutoffCountdown = getTimeUntilCutoffCT();
      const newMidnightCountdown = getTimeUntilMidnightCT();
  
      if (isFinalDay && !campaignEnded ) {
        await checkIfCampaignShouldEnd();
      }
      
      
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
        localStorage.removeItem("campaign_ended"); 
        if (isFinalDay) {
          try {
            await fetch(`${API_BASE}/api/campaign/end`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
              body: JSON.stringify({ campaign_id: campaignId }),
            });
          } catch (err) {
            console.error("Failed to end campaign:", err);
          }
        }
        window.location.reload();
      }
      
  
      setCutoffCountdown(newCutoffCountdown);
      setMidnightCountdown(newMidnightCountdown);
    }, 1000);
  
    return () => clearInterval(interval);
  }, [campaignDay, campaignId, campaignEnded, checkIfCampaignShouldEnd]);
  
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
  
      const nameLine = campaignDay?.name ? `🏰 Battle for Wordle: ${campaignDay.name}` : "🏰 Battle for Wordle";
      const dayLine = `📅 Day ${campaignDay?.day} of ${campaignDay?.total}`;
  
    const solvedRow = results.findIndex(r => r?.every(cell => cell === "correct"));
    const didSolve = solvedRow !== -1;
  
    const resultLine = didSolve
      ? `⚔️ Solved in ${solvedRow + 1}/6`
      : `❌ Failed - Disappointment to their King`;
  
    const homeLink = `Do your part at https://battleforwordle.com/home ⚔️`;
  
    return `${nameLine}\n${dayLine}\n${resultLine}\n\n${board}\n\n${homeLink}`;
  }
  
  

//function to submit the guess
  // This function will be called when the user presses Enter
  // It will send the current guess to the server and update the results
  const submitGuess = async () => {
    if (currentRow >= 6 || gameOver) return;
  
    const guess = guesses[currentRow].join("");
    const campaign_id = parseInt(localStorage.getItem("campaign_id"));
    const user_id = user?.user_id;

    if (!user_id || !campaign_id || guess.length !== 5) {
      console.warn("Missing user info, campaign ID, or guess too short");
      return;
    }    
    try {
      const res = await fetch(`${API_BASE}/api/guess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ word: guess, campaign_id }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        if (error.detail === "Invalid word") {
          setErrorMsg("❌ Not a valid word");
          setTimeout(() => setErrorMsg(null), 3000); // clears after 3 seconds
          return;
        }
         else {
          throw new Error(error.detail || "Unknown error");
        }
      }
  
      const data = await res.json();
  
      const newResults = [...results];
      newResults[currentRow] = data.result;
      setResults(newResults);
  
      const newStatus = { ...letterStatus };
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i].toLowerCase();
        const result = data.result[i];
        const current = newStatus[letter];
  
        if (result === "correct") {
          newStatus[letter] = "correct";
        } else if (result === "present" && current !== "correct") {
          newStatus[letter] = "present";
        } else if (!current) {
          newStatus[letter] = "absent";
        }
      }
      setLetterStatus(newStatus);
  
      if (data.result.every(r => r === "correct")) {
        setGameOver(true);
      
        let baseTroops = [150, 100, 60, 40, 30, 10][currentRow];
        const awardedTroops = doubleDownStatus.activated && currentRow <= 2 ? baseTroops * 2 : baseTroops;

        if (currentRow <= 2) {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
          });
        }
      
        setTroopsEarned(awardedTroops); 
        setShowTroopModal(true);
      
        // 🧠 Check for campaign end eligibility if it's the final day
        if (isFinalCampaignDay(campaignDay)) {
          await checkIfCampaignShouldEnd();
        }
      
        return;
      }
      
      const maxAttempts = doubleDownStatus.activated ? 3 : 6;
      if (currentRow + 1 === maxAttempts) {
        setGameOver(true);
        setFailedWord(data.word.toUpperCase());
        setTimeout(() => setShowFailureModal(true), 300);
        return;
      }
      
      
  
      // Advance to next row
      setCurrentRow(currentRow + 1);
      if (currentRow === 0 && !doubleDownStatus.activated) {
        setTimeout(() => setShowDoubleDownModal(true), 400);
      }      
      setCurrentCol(0);
    
    } catch (err) {
      console.error("Guess submission failed:", err);
      alert("⚠️ Failed to submit guess. Please try again.");
    }
  };  

  
  
  const handleKeyPress = (key) => {
    if (gameOver || campaignEnded) return;
  
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
      if (currentCol === 5) {
        submitGuess();
      }
    } else {
      if (currentCol < 5) {
        const newGuesses = [...guesses];
        newGuesses[currentRow][currentCol] = key;
        setGuesses(newGuesses);
        setCurrentCol(currentCol + 1);
      }
    }
  };

  function hslToCssString(hsl) {
    const h = Math.round(hsl.h);
    const s = Math.round(hsl.s); 
    const l = Math.round(hsl.l); 
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  
  function cssStringToHSL(cssColor) {
    // Create a dummy div to resolve computed color
    const dummy = document.createElement("div");
    dummy.style.color = cssColor;
    document.body.appendChild(dummy);
  
    const computed = getComputedStyle(dummy).color; // Always returns rgb()
    document.body.removeChild(dummy);
  
    const [r, g, b] = computed
      .match(/\d+/g)
      .map(Number)
      .map((val) => val / 255);
  
    const max = Math.max(r, g, b),
          min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
  
    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0; // Default case to handle unexpected values
      }
  
      h *= 60;
    }
  
    return {
      h: Math.round(h),
      s: parseFloat(s.toFixed(3)),
      l: parseFloat(l.toFixed(3)),
    };
  }
  
  
  return (
    <div className="game-wrapper">
      <div className="game-content">
        <div className="game-inner">
          <button
            className="home-button"
            onClick={() => {
              localStorage.removeItem("campaign_id");
              localStorage.removeItem("invite_code");
              localStorage.removeItem("campaign_ended");
              localStorage.removeItem("campaign_name");
              navigate("/home");
            }}
          >
            <FontAwesomeIcon icon={faLandmark} />
          </button>
  
          <Header
            campaignDay={campaignDay}
            cutoffCountdown={cutoffCountdown}
            midnightCountdown={midnightCountdown}
            isFinalDay={isFinalCampaignDay(campaignDay)}
            campaignEnded={campaignEnded}
            playerDisplayName={playerDisplayName}
            playerColor={playerColor}
            doubleDownUsed={doubleDownStatus.usedThisWeek}
            doubleDownActivated={doubleDownStatus.activated}
            onEditClick={() => {
              setNewDisplayName(playerDisplayName);
              setNewColor(playerColor);
              setPickerColor(cssStringToHSL(playerColor));
              setShowEditModal(true);
            }}
          />
    {gameOver && !showTroopModal && (
            <div className="share-button-container">
              <button
                className="share-btn"
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
                📤 Share Your Result
              </button>
            </div>
          )}
          {/* Re-inserted core game components */}
          <WordGrid
            guesses={guesses}
            results={results}
            currentRow={currentRow}
            currentCol={currentCol}
            maxVisibleRows={doubleDownStatus.activated ? 3 : 6}
            />
          <Keyboard letterStatus={letterStatus} onKeyPress={handleKeyPress} />
  
          {errorMsg && <div className="error-msg">{errorMsg}</div>}
        </div>
      </div>
  
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
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Your Identity</h2>
            <label>Display Name</label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
            <label>Color</label>
            <div className="color-picker-wrapper">
              <div
                className="current-color-preview"
                style={{ backgroundColor: hslToCssString(pickerColor) }}
                onClick={() => setShowWheel(!showWheel)}
              />
              {showWheel && (
                <div className="wheel-container">
                  <HslColorPicker
                    color={pickerColor}
                    onChange={(color) => {
                      setPickerColor(color);
                      setNewColor(hslToCssString(color));
                    }}
                  />
                </div>
              )}
            </div>
            <div className="modal-buttons">
              <button
                className="troop-btn"
                onClick={async () => {
                  const res = await fetch(`${API_BASE}/api/campaign/update_member`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: JSON.stringify({
                      campaign_id: campaignId,
                      user_id: user.user_id,
                      display_name: newDisplayName,
                      color: newColor,
                    }),
                  });
                  if (res.ok) {
                    setPlayerDisplayName(newDisplayName);
                    setPlayerColor(newColor);
                    setShowEditModal(false);
                  } else {
                    alert("Update failed");
                  }
                }}
              >
                Save
              </button>
              <button
                className="troop-btn close-btn"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
        <DoubleDownModal
          visible={showDoubleDownModal}
          onAccept={async () => {
            try {
              const res = await fetch(`${API_BASE}/api/double_down`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
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
