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
import Leaderboard from './pages/Leaderboard';
import { AuthProvider } from './auth/AuthProvider';
import RedirectIfAuthenticated from './auth/RedirectIfAuthenticated';
import RequireAuth from './auth/RequireAuth'; // ✅ Import protection wrapper
import LayoutWithSidebar from './components/LayoutWithSidebar'; // ✅ new import

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public invite route */}
          <Route path="/invite" element={<Invite />} />

          {/* ✅ Protected Routes */}
          <Route
              path="/home"
              element={
                <RequireAuth>
                  <LayoutWithSidebar>
                    <Home />
                  </LayoutWithSidebar>
                </RequireAuth>
              }
            />
            <Route
              path="/game"
              element={
                <RequireAuth>
                  <LayoutWithSidebar>
                    <GameScreen />
                  </LayoutWithSidebar>
                </RequireAuth>
              }
            />
            <Route
              path="/leaderboard/:id"
              element={
                <RequireAuth>
                  <LayoutWithSidebar>
                    <Leaderboard />
                  </LayoutWithSidebar>
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <LayoutWithSidebar>
                    <AccountScreen />
                  </LayoutWithSidebar>
                </RequireAuth>
              }
            />
          {/* 🔓 Public Routes with redirect if already logged in */}
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
