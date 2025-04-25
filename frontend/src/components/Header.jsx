import React from 'react';
import '../styles/Header.css';
import InviteShareButton from './InviteShareButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen } from '@fortawesome/free-solid-svg-icons';


export default function Header({
  campaignDay,
  cutoffCountdown,
  midnightCountdown,
  isFinalDay,
  campaignEnded,
  onToggleLeaderboard,
  playerDisplayName,
  playerColor,
  onEditClick, // 🆕 added prop
}) {
  return (
    <div className="header-container">
      <div className="header-row">
        <div className="header-left">
          {/* 🧙 Player display name + color dot */}
          {playerDisplayName && (
            <div className="player-info-badge">
              <span className="color-dot" style={{ backgroundColor: playerColor }}></span>
              {playerDisplayName}
              <button className="edit-display-btn" onClick={onEditClick}>
                <FontAwesomeIcon icon={faPen} />
              </button>
            </div>
          )}

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
              ⏳ {isFinalDay ? "Campaign ends in" : "Next word in"}:{" "}
              {isFinalDay ? cutoffCountdown.hours : midnightCountdown.hours}h{" "}
              {isFinalDay ? cutoffCountdown.minutes : midnightCountdown.minutes}m{" "}
              {isFinalDay ? cutoffCountdown.seconds : midnightCountdown.seconds}s
            </p>
          )}

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
