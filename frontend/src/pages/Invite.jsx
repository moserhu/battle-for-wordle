import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/Invite.css';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000`;

export default function Invite() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get("campaign_id");
  const campaignName = searchParams.get("campaign_name");
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const redirectURL = `/invite?campaign_id=${campaignId}&campaign_name=${encodeURIComponent(campaignName)}`;
      navigate(`/login?redirectTo=${encodeURIComponent(redirectURL)}`);
    }
  }, [loading, isAuthenticated, navigate, campaignId, campaignName]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");
  
    try {
      const res = await fetch(`${API_BASE}/api/campaign/join_by_id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ campaign_id: parseInt(campaignId) }),
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        const message = typeof data.detail === "string" 
          ? data.detail 
          : JSON.stringify(data.detail);
          if (res.status === 410) {
            throw new Error("❌ This invite has expired. Ask the campaign owner to send a new one.");
          }
          throw new Error(message || "Failed to join campaign");
        }
  
      // Save campaign to localStorage
      const { invite_code } = data;
      localStorage.setItem("campaign_id", campaignId);
      localStorage.setItem("campaign_name", campaignName);
      localStorage.setItem("invite_code", invite_code);
  
      navigate("/game");
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };
  

  const handleDecline = () => {
    navigate("/home");
  };

  if (!campaignId || !campaignName) {
    return <div className="invite-error">Invalid or missing invite link</div>;
  }

  return (
    <div className="invite-screen">
      <div className="invite-box">
        <h1>📜 You’ve Been Summoned</h1>
        <p className="campaign-name">Campaign: <strong>{decodeURIComponent(campaignName)}</strong></p>
        <p>Would you like to join this campaign?</p>
        {error && <p className="error-msg">{error}</p>}
        <div className="invite-buttons">
          <button onClick={handleJoin} disabled={joining} className='accept-btn'>✅ Join Campaign</button>
          <button onClick={handleDecline} className="decline-btn">❌ Decline</button>
        </div>
      </div>
    </div>
  );
}
