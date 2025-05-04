import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  playerDisplayName,
  playerColor,
  onEditClick,
}) {
  const navigate = useNavigate();
  const campaignId = localStorage.getItem("campaign_id");

  return (
    <div className="header-container">
      <div className="header-row">
        <div className="header-left">
          {/* Player Info */}
          {playerDisplayName && (
            <div className="player-info-badge">
              <span className="color-dot" style={{ backgroundColor: playerColor }}></span>
              {playerDisplayName}
              <button className="edit-display-btn" onClick={onEditClick}>
                <FontAwesomeIcon icon={faPen} />
              </button>
            </div>
          )}

          {/* Campaign Info */}
          {campaignDay && (
            <p className="campaign-info">
              Day {campaignDay.day} of {campaignDay.total} • Campaign: <strong>{campaignDay.name}</strong>
            </p>
          )}

          {/* Countdown */}
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

          {/* Buttons */}
          <div className="header-buttons">
            <InviteShareButton />
            <button
              className="leaderboard-toggle-btn"
              onClick={() => navigate(`/leaderboard/${campaignId}`)}
            >
              View Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
