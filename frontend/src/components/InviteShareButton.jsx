import React, { useState } from "react";
import "../styles/InviteShare.css";

const FRONTEND_URL = `${window.location.protocol}//${window.location.host}`

export default function InviteShareButton() {
  const [showModal, setShowModal] = useState(false);


  const inviteCode = localStorage.getItem("invite_code"); 
  const campaignId = localStorage.getItem("campaign_id");
  const campaignName = localStorage.getItem("campaign_name") || "Campaign";
  const smartInviteURL = `${FRONTEND_URL}/invite?campaign_id=${campaignId}&campaign_name=${encodeURIComponent(campaignName)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteCode);
    alert("Invite code copied!");
  };
  
//   // Check if the device supports the Web Share API
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
