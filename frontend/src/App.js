// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameScreen from './pages/GameScreen';
import Home from './pages/Home';
import './App.css';
import AccountScreen from './pages/AccountScreen';
import LoginPage from './pages/Login';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/game" element={<GameScreen />} />
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<AccountScreen />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
