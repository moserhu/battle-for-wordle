// src/components/Header.jsx
import React from 'react';
import '../styles/Header.css';
import InviteShareButton from './InviteShareButton';

export default function Header({
  campaignDay,
  cutoffCountdown,
  midnightCountdown,
  isFinalDay,
  campaignEnded,
  onToggleLeaderboard
}) {
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
        {campaignEnded ? (
  <p className="countdown-timer">
    🏁 Campaign ended — new campaign begins in: {midnightCountdown.hours}h {midnightCountdown.minutes}m {midnightCountdown.seconds}s
  </p>
) : (
  <p className="countdown-timer">
    ⏳ {isFinalDay ? "Campaign ends in" : "Next word in"}: {cutoffCountdown.hours}h {cutoffCountdown.minutes}m {cutoffCountdown.seconds}s
  </p>
)}

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
