import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import WordGrid from '../components/WordGrid';
import Keyboard from '../components/Keyboard';
import { useNavigate } from 'react-router-dom';

const EMPTY_GRID = Array.from({ length: 6 }, () => Array(5).fill(""));

// Get the campaign_id from localStorage
const campaign_id = localStorage.getItem("campaign_id");
const saveKey = `wordle_state_${campaign_id}`;
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
  const [guesses, setGuesses] = useState(EMPTY_GRID);
  const [results, setResults] = useState(Array(6).fill(null));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [letterStatus, setLetterStatus] = useState({});
  const [campaignDay, setCampaignDay] = useState(null);
  const [countdown, setCountdown] = useState(getTimeUntilMidnightCT());
  const [errorMsg, setErrorMsg] = useState(null);


  useEffect(() => {
    const saved = localStorage.getItem(saveKey);
    const fetchCampaignDay = async () => {
      const res = await fetch("http://localhost:8000/api/campaign/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id }),
      });
    
      const data = await res.json();
      setCampaignDay(data);
    };
    
    fetchCampaignDay();
    
    if (saved) {
      const { guesses, results, currentRow, letterStatus, gameOver } = JSON.parse(saved);
      setGuesses(guesses);
      setResults(results);
      setLetterStatus(letterStatus);
      setGameOver(gameOver);
    
      const currentGuessRow = guesses[currentRow];
      const isRowFull = currentGuessRow.every(l => l !== "");
      const nextRow = isRowFull ? currentRow + 1 : currentRow;
      const nextCol = isRowFull ? 0 : currentGuessRow.findIndex(l => l === "");
    
      setCurrentRow(nextRow);
      setCurrentCol(nextCol);
    }
    
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
  

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px' }}>
      <button
      style={{ position: 'absolute', top: 20, right: 20 }}
      onClick={() => navigate('/home')}
      >
        ☰
      </button>
      <Header campaignDay={campaignDay} countdown={countdown} />
      {errorMsg && <div style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</div>}
      <WordGrid
      guesses={guesses}
     results={results}
     currentRow={currentRow}
      currentCol={currentCol}
      />
      <Keyboard onKeyPress={handleKeyPress} letterStatus={letterStatus} />
      <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
    </div>
  );
}
