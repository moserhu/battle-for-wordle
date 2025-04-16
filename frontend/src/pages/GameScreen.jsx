import React, { useState } from 'react';
import Header from '../components/Header';
import WordGrid from '../components/WordGrid';
import Keyboard from '../components/Keyboard';
import { useNavigate } from 'react-router-dom';

const EMPTY_GRID = Array.from({ length: 6 }, () => Array(5).fill(""));

export default function GameScreen() {
  const [guesses, setGuesses] = useState(EMPTY_GRID);
  const [results, setResults] = useState(Array(6).fill(null));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [letterStatus, setLetterStatus] = useState({});

  const navigate = useNavigate();

//function to submit the guess
  // This function will be called when the user presses Enter
  // It will send the current guess to the server and update the results
  const submitGuess = async () => {
    if (currentRow >= 6 || gameOver) return;
  
    const guess = guesses[currentRow].join("");
    const user_id = parseInt(localStorage.getItem("user_id"));
    const campaign_id = parseInt(localStorage.getItem("campaign_id"));
  
    const res = await fetch("http://localhost:8000/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: guess, user_id, campaign_id }),
    });
  
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
  
    if (data.result && data.result.every(r => r === "correct")) {
      setTimeout(() => alert("🎉 You solved it!"), 200);
      setGameOver(true); // ✅ Lock input
      return;
    }
  
    if (currentRow + 1 === 6) {
      setGameOver(true);
      setTimeout(() => {
        alert(`❌ Game Over! The word was "${data.word.toUpperCase()}"`);
      }, 200);
      return;
    }    
  
    setCurrentRow(currentRow + 1);
    setCurrentCol(0);
  };
  
  
  const handleKeyPress = (key) => {
    if (gameOver) return;
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
      <Header />
      <WordGrid guesses={guesses} results={results} />
      <Keyboard onKeyPress={handleKeyPress} letterStatus={letterStatus} />
      <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
    </div>
  );
}
