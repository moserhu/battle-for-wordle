import React, { useEffect, useState } from 'react';

export default function Leaderboard({ onBack }) {
  const [data, setData] = useState([]);
  const campaign_id = parseInt(localStorage.getItem("campaign_id"));

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
    <div style={{ padding: '20px' }}>
      <h2>🏆 Campaign Leaderboard</h2>
      <table style={{ borderCollapse: 'collapse', minWidth: '300px' }}>
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
      <button onClick={onBack}>Back to Game</button>
    </div>
  );
}
