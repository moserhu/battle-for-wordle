import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [campaignName, setCampaignName] = useState('');
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id');

  const createCampaign = async () => {
    const res = await fetch('http://localhost:8000/api/campaign/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: campaignName, user_id: parseInt(userId) }),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("campaign_id", data.campaign_id); 
      alert(`Campaign created! Invite code: ${data.invite_code}`);
      navigate('/game');
    } else {
      alert('Error creating campaign');
    }
  };

const [inviteCode, setInviteCode] = useState('');

const joinCampaign = async () => {
    const res = await fetch('http://localhost:8000/api/campaign/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: inviteCode, user_id: parseInt(userId) }),
    });
  
    const data = await res.json();
    console.log("JOIN CAMPAIGN RESPONSE:", data); // ✅ add this
  
    if (res.ok) {
      localStorage.setItem("campaign_id", data.campaign_id); // ✅ this is the line that matters
      alert(data.message);
      navigate('/game');
    } else {
      alert(data.detail);
    }
  };
  

  return (
    <div>
      <h2>Welcome!</h2>
      <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign Name" />
      <button onClick={createCampaign}>Create Campaign</button>
      <h3>Or Join Campaign</h3>
    <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Enter Invite Code" />
    <button onClick={joinCampaign}>Join</button>
    </div>
  );
}
