import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import Header from '../components/Header';
import WordGrid from '../components/WordGrid';
import Keyboard from '../components/Keyboard';
import Leaderboard from '../pages/Leaderboard';
import { useNavigate } from 'react-router-dom';
import '../styles/GameScreen.css';

const EMPTY_GRID = Array.from({ length: 6 }, () => Array(5).fill(""));

function getTimeUntilMidnightCT() {
  const now = new Date();

  // Convert local time to Central Time
  const nowCT = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));

  const midnightCT = new Date(nowCT);
  midnightCT.setHours(24, 0, 0, 0); // next midnight

  const diffMs = Math.max(midnightCT - nowCT, 0);

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return { hours, minutes, seconds };
}


export default function GameScreen() {
  const navigate = useNavigate();
  const [campaignId, setCampaignId] = useState(null);
  const [guesses, setGuesses] = useState(EMPTY_GRID);
  const [results, setResults] = useState(Array(6).fill(null));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [letterStatus, setLetterStatus] = useState({});
  const [campaignDay, setCampaignDay] = useState(null);
  const [countdown, setCountdown] = useState(getTimeUntilMidnightCT());
  const [errorMsg, setErrorMsg] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [screenshotLeft, setScreenshotLeft] = useState(null);
  const [screenshotRight, setScreenshotRight] = useState(null);
  const [imageHalfWidth, setImageHalfWidth] = useState(0);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [fadingBackIn, setFadingBackIn] = useState(false);



  const saveKey = campaignId ? `wordle_state_${campaignId}` : null;

  useEffect(() => {
    const storedId = localStorage.getItem("campaign_id");
    if (!storedId) {
      navigate("/home");
      return;
    }
    setCampaignId(parseInt(storedId));
  }, [navigate]);

  useEffect(() => {
    if (!campaignId) return;
  
    const saved = localStorage.getItem(`wordle_state_${campaignId}`);
    const user_id = parseInt(localStorage.getItem("user_id"));
  
    const fetchCampaignDayAndProgress = async () => {
      const res = await fetch("http://localhost:8000/api/campaign/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      setCampaignDay(data);
  
      const progressRes = await fetch("http://localhost:8000/api/game/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, campaign_id: campaignId }),
      });
  
      const progress = await progressRes.json();
      if (progress && progress.guesses) {
        setGuesses(progress.guesses);
        setResults(progress.results);
        setLetterStatus(progress.letter_status);
        setCurrentRow(progress.current_row);
        const guessRow = progress.guesses[progress.current_row] || [];
        const nextCol = guessRow.findIndex((l) => l === "");
        setCurrentCol(nextCol === -1 ? 5 : nextCol);
        setGameOver(progress.game_over);
        localStorage.setItem(`wordle_state_${campaignId}`, JSON.stringify(progress));
      } else if (saved) {
        const { guesses, results, currentRow, letterStatus, gameOver } = JSON.parse(saved);
        setGuesses(guesses);
        setResults(results);
        setLetterStatus(letterStatus);
        setGameOver(gameOver);
        setCurrentRow(currentRow);
        const guessRow = guesses[currentRow] || [];
        const nextCol = guessRow.findIndex((l) => l === "");
        setCurrentCol(nextCol === -1 ? 5 : nextCol);
              }
    };
  
    fetchCampaignDayAndProgress();
  }, [campaignId]);
  
  useEffect(() => {
    const updateWidth = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);
  

  //function to get the time until midnight CT
  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdown = getTimeUntilMidnightCT();
  
      // Auto-refresh when countdown hits zero
      if (
        newCountdown.hours === 0 &&
        newCountdown.minutes === 0 &&
        newCountdown.seconds === 0
      ) {
        window.location.reload(); 
      }
  
      setCountdown(newCountdown);
    }, 1000);
  
    return () => clearInterval(interval);
  }, []);
  
  
  const screenRef = useRef();

  
  //function to save the game state
  const saveGame = (
    customGameOver = false,
    customResults = results,
    customStatus = letterStatus,
    customRow = currentRow
  ) => {
    localStorage.setItem(saveKey, JSON.stringify({
      guesses: guesses.map(row => [...row]),
      results: customResults,
      currentRow: customRow,
      letterStatus: { ...customStatus },
      gameOver: customGameOver,
    }));
  };
  
  
  

//function to submit the guess
  // This function will be called when the user presses Enter
  // It will send the current guess to the server and update the results
  const submitGuess = async () => {
    if (currentRow >= 6 || gameOver) return;
  
    const guess = guesses[currentRow].join("");
    const user_id = parseInt(localStorage.getItem("user_id"));
    const campaign_id = parseInt(localStorage.getItem("campaign_id"));
  
    if (!user_id || !campaign_id || guess.length !== 5) {
      console.warn("Missing user_id, campaign_id, or incomplete guess");
      return;
    }
  
    try {
      const res = await fetch("http://localhost:8000/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: guess, user_id, campaign_id }),
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
        saveGame(true, newResults, newStatus);
        setTimeout(() => alert("🎉 You solved it!"), 200);
        return;
      }
  
      if (currentRow + 1 === 6) {
        setGameOver(true);
        saveGame(true, newResults, newStatus);
        setTimeout(() => {
          alert(`❌ Game Over! The word was "${data.word.toUpperCase()}"`);
        }, 200);
        return;
      }
  
      // Advance to next row
      const nextRow = currentRow + 1;
      setCurrentRow(currentRow + 1);
      setCurrentCol(0);
  
      saveGame(false, newResults, newStatus, nextRow);
  
    } catch (err) {
      console.error("Guess submission failed:", err);
      alert("⚠️ Failed to submit guess. Please try again.");
    }
  };  

  
  const handleKeyPress = (key) => {
    if (gameOver) return;
  
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
        setTimeout(() => {
          setShowLeaderboard(true);
          setAnimating(true);
        }, 2000);
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

    
  return (

<div className="screenshot-container" ref={screenRef}>
{/* Game UI Layer */}
        <div
          className={`game-content ${fadingBackIn ? "fade-in" : ""}`}
          style={{
            display:
            animating || (showLeaderboard && !fadingBackIn)
             ? 'none'
            : 'block'
           }}
          >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px' }}>
          <button
            style={{ position: 'absolute', top: 20, right: 20 }}
            onClick={() => {
              localStorage.removeItem(`wordle_state_${campaignId}`);
              localStorage.removeItem("campaign_id");
              setCampaignId(null);
              navigate("/home");
            }}
          >
            ☰
          </button>
          <Header campaignDay={campaignDay} countdown={countdown} onToggleLeaderboard={handleShowLeaderboard}  />
          {errorMsg && <div style={{ color: 'red' }}>{errorMsg}</div>}
          <WordGrid guesses={guesses} results={results} currentRow={currentRow} currentCol={currentCol} />
          <Keyboard onKeyPress={handleKeyPress} letterStatus={letterStatus} />
        </div>
      </div>
  
      {/* Screenshot Background */}
      {(screenshotLeft && screenshotRight) && (
  <div className="screenshot-overlay">
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

  </div>
)}

{/* Leaderboard Layer */}
{showLeaderboard && (
  <div className="leaderboard-wrapper">
    <Leaderboard onBack={handleBackToGame} />
  </div>
)}
    </div>
  );
  
}

