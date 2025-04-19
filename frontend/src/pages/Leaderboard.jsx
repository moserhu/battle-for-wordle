import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import '../styles/LeaderBoard.css'; 

ChartJS.register(ArcElement, Tooltip, Legend);

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

  const scores = data.map((entry) => entry.score);
  const names = data.map((entry) => entry.username);
  const colorPalette = [
    '#ffd700', // gold
    '#c0c0c0', // silver
    '#cd7f32', // bronze
    '#4caf50',
    '#2196f3',
    '#9c27b0',
    '#ff5722',
    '#00bcd4',
    '#795548',
    '#607d8b',
  ];
  
  const colorMap = data.reduce((acc, entry, index) => {
    acc[entry.username] = colorPalette[index % colorPalette.length];
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
        display: false,  // 🔇 hide the default legend
      },
    },
  };
  

  return (
    <div className="leaderboard-container">
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
            </tr>
          </thead>
          <tbody>
  {data.map((entry, i) => (
    <tr key={i}>
      <td style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            backgroundColor: colorMap[entry.username],
            marginRight: '8px',
            borderRadius: '2px',
          }}
        ></div>
        {entry.username}
      </td>
      <td>{entry.score}</td>
    </tr>
  ))}
</tbody>
        </table>
        <button onClick={onBack}>Back to Game</button>
      </div>

      
    </div>
  );
}
