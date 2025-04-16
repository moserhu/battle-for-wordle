import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState(localStorage.getItem('user_id'));
  const [error, setError] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [campaignName, setCampaignName] = useState('');

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!userId) return;
      const res = await fetch('http://localhost:8000/api/user/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId) }),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaigns(data);
      }
    };
    fetchCampaigns();
  }, [userId]);

  const handleLogin = async () => {
    const res = await fetch('http://localhost:8000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    try {
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('first_name', data.first_name);
        setUserId(data.user_id);
        setError('');
      } else {
        if (data.detail) setError(data.detail);
        else if (Array.isArray(data) && data[0]?.msg) setError(data[0].msg);
        else setError('Login failed.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    }
  };

  const handleRegister = async () => {
    const res = await fetch('http://localhost:8000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, phone, email, password }),
    });
    try {
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('first_name', firstName);
        setUserId(data.user_id);
        setError('');
      } else {
        if (data.detail) setError(data.detail);
        else if (Array.isArray(data) && data[0]?.msg) setError(data[0].msg);
        else setError('Registration failed.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    }
  };

  const handleCreate = async () => {
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
      alert(data.detail || 'Create failed');
    }
  };

  const handleJoin = async () => {
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
      alert(data.detail || 'Join failed');
    }
  };

  const logout = () => {
    localStorage.clear();
    setUserId(null);
    setEmail('');
    setPassword('');
    setCampaigns([]);
    setFirstName('');
    setLastName('');
    setPhone('');
    setInviteCode('');
    setCampaignName('');
  };
  

  const modalStyle = {
    background: '#fff',
    padding: '20px',
    position: 'fixed',
    top: '30%',
    left: '50%',
    transform: 'translate(-50%, -30%)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    borderRadius: '8px',
    zIndex: 1000,
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
      <h1>Battle for Wordle</h1>
      {!userId && (
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

    {mode === 'login' ? (
      <>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
        />
        <button onClick={handleLogin} style={{ padding: '10px 20px' }}>
          Login
        </button>
      </>
    ) : (
      <>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First Name"
          style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last Name"
          style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ display: 'block', margin: '10px auto', padding: '8px', width: '100%' }}
        />
        <button onClick={handleRegister} style={{ padding: '10px 20px' }}>
          Register
        </button>
      </>
    )}

    {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
  </>
)}

{userId && (
  <>
    <h2>Welcome, {localStorage.getItem('first_name') || 'Player'}!</h2>

    <div style={{ marginTop: '30px' }}>
      <button onClick={() => setShowJoinModal(true)} style={{ margin: '10px', padding: '10px 20px' }}>Join Campaign</button>
      <button onClick={() => setShowCreateModal(true)} style={{ margin: '10px', padding: '10px 20px' }}>Create Campaign</button>
    </div>

    {campaigns.length > 0 && (
      <table style={{ width: '100%', margin: '20px 0', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid white', padding: '10px', background: 'gray', color: '#fff' }}>Campaign</th>
            <th style={{ border: '1px solid white', padding: '10px', background: 'gray', color: '#fff' }}>Played Today?</th>
            <th style={{ border: '1px solid white', padding: '10px', background: 'gray', color: '#fff' }}></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((camp) => (
            <tr key={camp.campaign_id}>
              <td style={{ border: '1px solid white', padding: '10px' }}>{camp.name}</td>
              <td style={{ border: '1px solid white', padding: '10px' }}>{camp.has_played ? '✅' : '❌'}</td>
              <td style={{ border: '1px solid white', padding: '10px' }}>
                <button
                  onClick={() => {
                    localStorage.setItem('campaign_id', camp.campaign_id);
                    navigate('/game');
                  }}
                >
                  Play
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    <button onClick={logout} style={{ marginTop: '20px', padding: '8px 16px' }}>Logout</button>
  </>
)}

  
      {/* Join Modal */}
      {showJoinModal && (
        <div style={modalStyle}>
          <h3>Join Campaign</h3>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter Invite Code"
            style={{ marginBottom: '10px', padding: '8px', width: '100%' }}
          />
          <div>
            <button onClick={handleJoin} style={{ marginRight: '10px' }}>Join</button>
            <button onClick={() => setShowJoinModal(false)}>Cancel</button>
          </div>
        </div>
      )}
  
      {/* Create Modal */}
      {showCreateModal && (
        <div style={modalStyle}>
          <h3>Create Campaign</h3>
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="Campaign Name"
            style={{ marginBottom: '10px', padding: '8px', width: '100%' }}
          />
          <div>
            <button onClick={handleCreate} style={{ marginRight: '10px' }}>Create</button>
            <button onClick={() => setShowCreateModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );  
    
}
