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
  doubleDownUsed,
  doubleDownActivated,
  campaignId
}) {
  const navigate = useNavigate();

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

          {/* Double Down Status */}
          <div className="double-down-status">
            {doubleDownUsed ? (
              <span className="dd-used">⚠️ Double Down Used</span>
            ) : doubleDownActivated ? (
              <span className="dd-active">⚔️ Double Down Active</span>
            ) : (
              <span className="dd-available">🛡️ Double Down Available</span>
            )}
          </div>
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
          <InviteShareButton
            campaignId={campaignId}
            campaignName={campaignDay?.name || "Campaign"}
            inviteCode={campaignDay?.invite_code}
          />
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
