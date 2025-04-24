import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/AccountScreen.css';

export default function AccountScreen() {
  const [user, setUser] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    campaigns: 0,
    total_guesses: 0,
    correct_guesses: 0,
    campaign_wins: 0,
    campaign_losses: 0,
  });

  const [originalUser, setOriginalUser] = useState({});
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  const navigate = useNavigate();
  const { user: authUser, token, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!isAuthenticated || !authUser?.user_id)) {
      navigate('/login');
    }
  }, [loading, isAuthenticated, authUser, navigate]);

  useEffect(() => {
    const fetchUser = async () => {
      const res = await fetch('http://localhost:8000/api/user/info', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setOriginalUser(data);
      }
    };

    if (!loading && token) {
      fetchUser();
    }
  }, [loading, token]);

  if (loading) return null;

  const handleChange = (e) => {
    setUser((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    const res = await fetch('http://localhost:8000/api/user/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: authUser.user_id, ...user }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage('✅ Info updated');
      setOriginalUser(user);
      setEditing(false);
    } else {
      setMessage(data.detail || '⚠️ Update failed');
    }
  };

  const hasChanges = JSON.stringify(user) !== JSON.stringify(originalUser);

  return (
    <div className="account-wrapper">
      <div className="account-screen">
        <button onClick={() => navigate('/home')} className="back-btn">← Back to Home</button>
        <h2>My Account</h2>

        <div className="account-info">
          {!editing ? (
            <>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>First Name:</strong> {user.first_name}</p>
              <p><strong>Last Name:</strong> {user.last_name}</p>
              <p><strong>Phone:</strong> {user.phone}</p>
              <button onClick={() => setEditing(true)} className="edit-btn">Make Changes</button>
            </>
          ) : (
            <>
              <label>Email (unchangeable)</label>
              <input type="email" value={user.email} disabled />

              <label>First Name</label>
              <input name="first_name" value={user.first_name} onChange={handleChange} />

              <label>Last Name</label>
              <input name="last_name" value={user.last_name} onChange={handleChange} />

              <label>Phone</label>
              <input name="phone" value={user.phone} onChange={handleChange} />

              {hasChanges && <button onClick={handleSave} className="save-btn">Save Changes</button>}
              <button onClick={() => setEditing(false)} className="cancel-btn">Cancel</button>
              {message && <p className="message">{message}</p>}
            </>
          )}
        </div>

        <div className="account-highlights">
          <h3>Campaign Highlights</h3>
          <div className="highlight-box">
            <p>Campaigns joined: {user.campaigns}</p>
            <p>Total guesses: {user.total_guesses}</p>
            <p>Correct guesses: {user.correct_guesses}</p>
            <p>Victories: {user.campaign_wins}</p>
            <p>Losses: {user.campaign_losses}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
