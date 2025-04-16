import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Leaderboard() {
  const [data, setData] = useState([]);
  const campaign_id = parseInt(localStorage.getItem("campaign_id"));
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const res = await fetch("http://localhost:8000/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id }),
      });

      const json = await res.json();
      setData(json);
    };

    fetchLeaderboard();
  }, [campaign_id]);

  return (
    <div style={{ textAlign: 'center', marginTop: '30px' }}>
      <h2>🏆 Campaign Leaderboard</h2>
      <table style={{ margin: '20px auto', borderCollapse: 'collapse', minWidth: '300px' }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid gray', paddingBottom: '10px' }}>Player</th>
            <th style={{ borderBottom: '1px solid gray', paddingBottom: '10px' }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr key={i}>
              <td style={{ padding: '10px' }}>{entry.username}</td>
              <td>{entry.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => navigate('/game')}>Back to Game</button>
    </div>
  );
}
