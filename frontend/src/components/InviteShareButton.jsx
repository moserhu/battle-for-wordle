import React, { useState } from "react";

const FRONTEND_URL = `${window.location.protocol}//${window.location.hostname}`;

export default function InviteShareButton({ campaignId, campaignName, inviteCode }) {
  const [showModal, setShowModal] = useState(false);

  const smartInviteURL = `${FRONTEND_URL}/invite?campaign_id=${campaignId}&campaign_name=${encodeURIComponent(campaignName)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteCode);
    alert("Invite code copied!");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join the Frey "${campaignName}"`,
          url: smartInviteURL,
        });
      } catch (error) {
        console.error("Sharing failed", error);
      }
    } else {
      alert("Sharing not supported on this device");
    }
  };

  return (
    <>
      <button className="invite-share-button" onClick={() => setShowModal(true)}>
        Invite
      </button>

      {showModal && (
        <div className="invite-modal-overlay">
          <div className="invite-modal">
            <button className="close-button" onClick={() => setShowModal(false)}>×</button>
            <h3>Invite Code</h3>
            <p className="invite-code">{inviteCode}</p>

            <div className="invite-actions">
              <button className="copy-btn" onClick={copyToClipboard}>Copy</button>
              <button className="share-btn" onClick={handleShare}>Share</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
