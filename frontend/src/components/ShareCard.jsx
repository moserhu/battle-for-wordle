// frontend/src/components/ShareCard.jsx
import React from "react";
import '../styles/ShareCard.css';

const FRONTEND_URL = `${window.location.protocol}//${window.location.hostname}`;

export default function ShareCard({ campaignId, campaignName, inviteCode }) {
  const smartInviteURL = `${FRONTEND_URL}/invite?campaign_id=${campaignId}&campaign_name=${encodeURIComponent(campaignName)}`;

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join the Frey "${campaignName}"`,
          url: smartInviteURL,
        });
      } catch (e) {
        console.error("Share failed", e);
      }
    } else {
      navigator.clipboard.writeText(smartInviteURL);
      alert("Sharing not supported — link copied!");
    }
  };

  return (
    <div className="sharecard-container">
      <h3>Invite Players</h3>

      <span className="sharecard-code">{inviteCode}</span>

      <div className="sharecard-buttons">
        <button className="sharecard-btn" onClick={copyCode}>
          Copy Code
        </button>
        <button className="sharecard-btn" onClick={handleShare}>
          Share
        </button>
      </div>
    </div>
  );
}
