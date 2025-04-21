// src/components/Header.jsx
import React from 'react';
import '../styles/Header.css';
import InviteShareButton from './InviteShareButton';

export default function Header({ campaignDay, countdown, onToggleLeaderboard }) {
  return (
    <div className="header-container">
  <div className="header-row">
    <div className="header-left">
      <h1 className="header-title">Battle for Wordle</h1>

      {campaignDay && (
        <p className="campaign-info">
          Day {campaignDay.day} of {campaignDay.total} • Campaign: <strong>{campaignDay.name}</strong>
        </p>
      )}

      <p className="countdown-timer">
        ⏳ Next word in: {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
      </p>

      {/* ⚔ Both buttons grouped here */}
      <div className="header-buttons">
          <InviteShareButton />
        <button className="leaderboard-toggle-btn" onClick={onToggleLeaderboard}>
          View Leaderboard
        </button>
      </div>
    </div>
  </div>
</div>

  );
}
