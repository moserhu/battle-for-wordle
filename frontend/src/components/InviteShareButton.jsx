import React, { useState } from "react";
import "../styles/InviteShare.css";

export default function InviteShareButton() {
  const [showModal, setShowModal] = useState(false);
  const inviteCode = localStorage.getItem("invite_code"); // or pass as prop

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteCode);
    alert("Invite code copied!");
  };
  
//   // Check if the device supports the Web Share API
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join My Campaign",
          text: `Use this invite code to join: ${inviteCode}`,
          url: "http://192.168.1.174:3000/home", 
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
