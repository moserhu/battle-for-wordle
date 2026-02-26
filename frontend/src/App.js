// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import GameScreen from './pages/GameScreen';
import Home from './pages/Home';
import './App.css';
import AccountScreen from './pages/AccountScreen';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MainLandingPage from './pages/MainLandingPage';
import Invite from './pages/Invite';
import Leaderboard from './pages/Leaderboard';
import { AuthProvider } from './auth/AuthProvider';
import RedirectIfAuthenticated from './auth/RedirectIfAuthenticated';
import RequireAuth from './auth/RequireAuth';
import NavBar from './components/NavBar';
import Campaigns from './pages/Campaigns';
import CampaignDashboard from './pages/CampaignDashboard';
import Shop from './pages/Shop';
import ItemsStorage from './pages/ItemsStorage';
import UpdateLogs from './pages/UpdateLogs';

function AppShell() {
  const location = useLocation();

  // 🔒 routes where NavBar should be hidden
  const hideNavOn = ['/', '/login', '/register', '/invite', '/forgot-password', '/reset-password'];
  const hideNav = hideNavOn.includes(location.pathname);

  return (
    <>
      {!hideNav && <NavBar />}
      <div className="app-content">
        <Routes>
          {/* Public invite route */}
          <Route path="/invite" element={<Invite />} />

          {/* ✅ Protected Routes */}
          <Route
            path="/home"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/campaigns"
            element={
              <RequireAuth>
                <Campaigns />
              </RequireAuth>
            }
          />
          <Route
            path="/campaign/:campaignId"
            element={
              <RequireAuth>
                <CampaignDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/campaign/:campaignId/shop"
            element={
              <RequireAuth>
                <Shop />
              </RequireAuth>
            }
          />
          <Route
            path="/campaign/:campaignId/items"
            element={
              <RequireAuth>
                <ItemsStorage />
              </RequireAuth>
            }
          />
          <Route
            path="/game"
            element={
              <RequireAuth>
                <GameScreen />
              </RequireAuth>
            }
          />
          <Route
            path="/leaderboard/:id"
            element={
              <RequireAuth>
                <Leaderboard />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountScreen />
              </RequireAuth>
            }
          />
          <Route
            path="/updates"
            element={
              <RequireAuth>
                <UpdateLogs />
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
            path="/forgot-password"
            element={
              <RedirectIfAuthenticated>
                <ForgotPassword />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/reset-password"
            element={<ResetPassword />}
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
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </Router>
  );
}

export default App;
