import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import Header from '../components/Header';
import WordGrid from '../components/WordGrid';
import Keyboard from '../components/Keyboard';
import Leaderboard from '../pages/Leaderboard';
import { useNavigate } from 'react-router-dom';
import '../styles/GameScreen.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLandmark } from "@fortawesome/free-solid-svg-icons";
import confetti from 'canvas-confetti';
import { useAuth } from '../auth/AuthProvider';


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
  const [animating, setAnimating] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [screenshotLeft, setScreenshotLeft] = useState(null);
  const [screenshotRight, setScreenshotRight] = useState(null);
  const [imageHalfWidth, setImageHalfWidth] = useState(0);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [fadingBackIn, setFadingBackIn] = useState(false);
  const [showTroopModal, setShowTroopModal] = useState(false);
  const [troopsEarned, setTroopsEarned] = useState(0);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  
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
      setLoadingLeaderboard(true);
      setGuesses(EMPTY_GRID);
      setResults(Array(6).fill(null));
      setCurrentRow(0);
      setCurrentCol(0);
      setGameOver(false);
      setLetterStatus({});
      setShowTroopModal(false);
      setTroopsEarned(0);

      const [dayRes, stateRes] = await Promise.all([
        fetch("http://localhost:8000/api/campaign/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ campaign_id: id }),
        }),
        fetch("http://localhost:8000/api/game/state", {
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
      console.log("Fetched game state:", progress);
      setCampaignDay(campaignDay);
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

      setLoadingLeaderboard(false);
    };

    resetAndFetch();
  }, [user, loading, navigate]);

  
  useEffect(() => {
    const updateWidth = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);
  

  const checkIfCampaignShouldEnd = useCallback(async () => {
    const res = await fetch("http://localhost:8000/api/campaign/finished_today", {
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
        localStorage.removeItem("campaign_ended"); // 🔥 Add this
        if (isFinalDay) {
          try {
            await fetch("http://localhost:8000/api/campaign/end", {
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
  
  
  
  
  const screenRef = useRef();  
  
  
  

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
      const res = await fetch("http://localhost:8000/api/guess", {
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
      
        const troops = [12, 8, 6, 4, 3, 1][currentRow];
      
        if (currentRow <= 2) {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
          });
        }
      
        setTroopsEarned(troops); 
        setShowTroopModal(true);
      
        // 🧠 Check for campaign end eligibility if it's the final day
        if (isFinalCampaignDay(campaignDay)) {
          await checkIfCampaignShouldEnd();
        }
      
        return;
      }
      
      
      
      if (currentRow + 1 === 6) {
        setGameOver(true);
        setTimeout(() => {
          alert(`❌ Game Over! The word was "${data.word.toUpperCase()}"`);
        }, 200);
        return;
      }
  
      // Advance to next row
      setCurrentRow(currentRow + 1);
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


  
  const handleShowLeaderboard = async () => {

  
    const splitScreenshot = (dataUrl) => {
      const img = new Image();
      img.onload = () => {
        const canvasWidth = img.width;
        const canvasHeight = img.height;
    
        const leftCanvas = document.createElement("canvas");
        const rightCanvas = document.createElement("canvas");
    
        leftCanvas.width = canvasWidth / 2;
        leftCanvas.height = canvasHeight;
        rightCanvas.width = canvasWidth / 2;
        rightCanvas.height = canvasHeight;
    
        const leftCtx = leftCanvas.getContext("2d");
        const rightCtx = rightCanvas.getContext("2d");
    
        leftCtx.drawImage(img, 0, 0, canvasWidth / 2, canvasHeight, 0, 0, canvasWidth / 2, canvasHeight);
        rightCtx.drawImage(img, canvasWidth / 2, 0, canvasWidth / 2, canvasHeight, 0, 0, canvasWidth / 2, canvasHeight);
    
        setScreenshotLeft(leftCanvas.toDataURL());
        setScreenshotRight(rightCanvas.toDataURL());
    
        // 🎯 Use real screen width to position them correctly
        const realDOMWidth = screenRef.current.offsetWidth;
        setImageHalfWidth(realDOMWidth / 2);
        

        requestAnimationFrame(() => setAnimating(true));
   
          setShowLeaderboard(true);
          setAnimating(true);
     
      };
   
      img.src = dataUrl;
    };
    
      
    const canvas = await html2canvas(screenRef.current, {
      useCORS: true,
      backgroundColor: null,
      scale: window.devicePixelRatio || 1,
      
    });
    const fullScreenshot = canvas.toDataURL("image/png");
    splitScreenshot(fullScreenshot);


  };
  
  const handleBackToGame = () => {
    setShowLeaderboard(false);
    setScreenshotLeft(null);
    setScreenshotRight(null);
    setAnimating(false);
    setFadingBackIn(true);
    setTimeout(() => setFadingBackIn(false), 500); // match fade duration
  };

  useEffect(() => {
    console.log("RENDERED:", { campaignId, guesses });
    console.log("localStorage keys:", Object.keys(localStorage));
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("wordle_state_")) {
        console.log(`${key}:`, localStorage.getItem(key));
      }
    });
  }, [guesses, campaignId]);
  
    
  return (
    <div className="screenshot-container" ref={screenRef}>
      {/* Game UI Layer */}
      <div className="game-wrapper">
        <div className={`game-content ${fadingBackIn ? "fade-in" : ""} ${animating || (showLeaderboard && !fadingBackIn) ? "hidden" : ""}`}>
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
              onToggleLeaderboard={handleShowLeaderboard}
            />

            {errorMsg && <div className="error-msg">{errorMsg}</div>}
            {!loadingLeaderboard && (
              <>
                <WordGrid guesses={guesses} results={results} currentRow={currentRow} currentCol={currentCol} />
                <Keyboard onKeyPress={handleKeyPress} letterStatus={letterStatus} />
              </>
            )}
          </div>
        </div>
  
        {/* Screenshot Background */}
        {(screenshotLeft && screenshotRight) && (
          <div className="screenshot-overlay">
            <img
              src={screenshotLeft}
              alt="Left Half"
              className={`split-half left ${animating ? 'slide-left' : ''}`}
              style={{ left: `${screenWidth / 2 - imageHalfWidth}px` }}
            />
            <img
              src={screenshotRight}
              alt="Right Half"
              className={`split-half right ${animating ? 'slide-right' : ''}`}
              style={{ left: `${screenWidth / 2}px` }}
            />
          </div>
        )}
  
        {/* Leaderboard */}
        {showLeaderboard && (
          <div className="leaderboard-wrapper">
            <button
              className="home-button"
              onClick={() => {
                localStorage.removeItem("campaign_id");
                localStorage.removeItem("campaign_ended"); 
                localStorage.removeItem("campaign_name");
                setCampaignId(null);
                setGuesses(EMPTY_GRID);
                navigate("/home");
              }}
            >
              <FontAwesomeIcon icon={faLandmark} />
            </button>
            <Leaderboard onBack={handleBackToGame} />
          </div>
        )}
  
        {/* Troop Modal */}
        {showTroopModal && (
          <div className="troop-modal-overlay">
            <div className="troop-modal">
              <h2>🎖 Victory!</h2>
              <p>You gained <strong>{troopsEarned}</strong> troops.</p>
              <div className="modal-buttons">
                <button className="troop-btn close-btn" onClick={() => setShowTroopModal(false)}>❌ Close</button>
                <button className="troop-btn leaderboard-btn" onClick={() => {
                  setShowTroopModal(false);
                  handleShowLeaderboard();
                }}>🏰 Go to Leaderboard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  
}

