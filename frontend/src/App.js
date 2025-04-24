// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameScreen from './pages/GameScreen';
import Home from './pages/Home';
import './App.css';
import AccountScreen from './pages/AccountScreen';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLandingPage from './pages/MainLandingPage';
import Invite from './pages/Invite';
import { AuthProvider } from './auth/AuthProvider';
import RedirectIfAuthenticated from './auth/RedirectIfAuthenticated';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
        <Route path="/invite" element={<Invite />} />
          <Route path="/home" element={<Home />} />
          <Route path="/game" element={<GameScreen />} />
          <Route path="/account" element={<AccountScreen />} />

          {/* Public routes with redirect if already logged in */}
          <Route
            path="/"
            element={
              <RedirectIfAuthenticated>
                <MainLandingPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfAuthenticated>
                <Register />
              </RedirectIfAuthenticated>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}


export default App;
