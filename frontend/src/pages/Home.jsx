import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [userId, setUserId] = useState(localStorage.getItem('user_id'));
  const [error, setError] = useState('');

  const handleAuth = async () => {
    const endpoint = mode === 'login' ? 'login' : 'register';
    const res = await fetch(`http://localhost:8000/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('user_id', data.user_id);
      setUserId(data.user_id);
    } else {
      setError(data.detail || 'Auth failed');
    }
  };

  const createCampaign = async () => {
    const res = await fetch('http://localhost:8000/api/campaign/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: campaignName, user_id: parseInt(userId) }),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('campaign_id', data.campaign_id);
      alert(`Invite code: ${data.invite_code}`);
      navigate('/game');
    } else {
      alert(data.detail || 'Error creating campaign');
    }
  };

  const joinCampaign = async () => {
    const res = await fetch('http://localhost:8000/api/campaign/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: inviteCode, user_id: parseInt(userId) }),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('campaign_id', data.campaign_id);
      navigate('/game');
    } else {
      alert(data.detail || 'Error joining campaign');
    }
  };

  const logout = () => {
    localStorage.clear();
    setUserId(null);
    setUsername('');
    setPassword('');
    setCampaignName('');
    setInviteCode('');
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', textAlign: 'center' }}>
      <h1>Battle for Wordle</h1>

      {!userId ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setMode('login')}
              style={{
                marginRight: 10,
                padding: '8px 16px',
                background: mode === 'login' ? '#444' : '#999',
                color: 'white',
                border: 'none',
              }}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              style={{
                padding: '8px 16px',
                background: mode === 'register' ? '#444' : '#999',
                color: 'white',
                border: 'none',
              }}
            >
              Register
            </button>
          </div>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
          />
          <button onClick={handleAuth} style={{ padding: '10px 20px' }}>
            {mode === 'login' ? 'Login' : 'Register'}
          </button>

          {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        </>
      ) : (
        <>
          <h2>Welcome, {username || 'User'}!</h2>
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="New Campaign Name"
            style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
          />
          <button onClick={createCampaign} style={{ marginBottom: '20px', padding: '10px 20px' }}>
            Create Campaign
          </button>

          <h3>Or Join a Campaign</h3>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Invite Code"
            style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
          />
          <button onClick={joinCampaign} style={{ padding: '10px 20px' }}>
            Join
          </button>

          <div style={{ marginTop: '20px' }}>
            <button onClick={logout} style={{ padding: '6px 12px', fontSize: '14px' }}>
              Log Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
