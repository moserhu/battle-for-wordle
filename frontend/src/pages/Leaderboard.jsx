import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import throneBackground from '../assets/throne_background.png'; // adjust path if needed
import '../styles/LeaderBoard.css'; 

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Leaderboard({ onBack }) {
  const [data, setData] = useState([]);
  const campaign_id = parseInt(localStorage.getItem("campaign_id"));
  const [declaredWinner, setDeclaredWinner] = useState(null);


  useEffect(() => {
    const fetchLeaderboard = async () => {
      const res = await fetch(`${API_BASE}/api/leaderboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id }),
      });
  
      const json = await res.json();
      setData(json);
  
      // 👑 Check for declared winner
      const campaignEndedFlag = localStorage.getItem("campaign_ended") === "true";

    if (campaignEndedFlag && json.length > 0) {
    const sorted = [...json].sort((a, b) => b.score - a.score);
    setDeclaredWinner(sorted[0]);
        }

    };
  
    fetchLeaderboard();
  }, [campaign_id]);

  const scores = data.map((entry) => entry.score);
  const names = data.map((entry) => entry.username);
  
  const colorMap = data.reduce((acc, entry) => {
    acc[entry.username] = entry.color || '#999';
    return acc;
  }, {});  
  
  const chartData = {
    labels: names,
    datasets: [
      {
        label: 'Troops',
        data: scores,
        backgroundColor: data.map((entry, i) => colorMap[entry.username]),
        borderColor: '#222',
        borderWidth: 2,
      },
    ],
  };
  const chartOptions = {
    plugins: {
      legend: {
        display: false, 
      },
    },
  };
  

  return declaredWinner ? (
    <div
      className="declared-winner-screen"
      style={{ backgroundImage: `url(${throneBackground})` }}
    >
      <div className="winner-content">
        <h1>👑 Declared Ruler</h1>
        <h2>{declaredWinner.username}</h2>
        <p>🏅 Troops: {declaredWinner.score}</p>
  
        <div className="loser-rankings">
          <h3>Subject Rankings</h3>
          <ol>
            {data
              .filter(player => player.username !== declaredWinner.username)
              .sort((a, b) => b.score - a.score)
              .map((player, i) => (
                <li key={i}>
                  {player.username} — {player.score} troops
                </li>
              ))}
          </ol>
        </div>
  
        <button className="back-button" onClick={onBack}>Back to Battle</button>
      </div>
    </div>
  ) : (
    <div className="leaderboard-container">
        <div className="leaderboard-content">
      <div className="leaderboard-pie">
        <Pie data={chartData} options={chartOptions} />
      </div>
      <div className="leaderboard-panel">
        <h2>🏆 Leaderboard</h2>
        <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Troops</th>
            <th>Battled?</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr key={i}>
              <td className="player-cell">
                <div
                  className="color-swatch"
                  style={{ backgroundColor: colorMap[entry.username] }}
                ></div>
                {entry.username}
              </td>
              <td>{entry.score}</td>
              <td style={{ textAlign: "center" }}>
                {entry.played_today ? "✅" : "❌"}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
        <button className="back-button" onClick={onBack}>
          Back to Battle
        </button>
      </div>
      </div>
    </div>
  );  
}
