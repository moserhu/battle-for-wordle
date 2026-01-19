import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import throneBackground from '../assets/scenes/throne_background.png';
import '../styles/LeaderBoard.css';
import defaultBackground from '../assets/branding/B4W_BG.png';
import { useAuth } from '../auth/AuthProvider';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Leaderboard() {
  const { id } = useParams();
  const campaignId = parseInt(id);  
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [declaredWinner, setDeclaredWinner] = useState(null);
  const [loading, setLoading] = useState(true); // 🆕
  const [hasEnded, setHasEnded] = useState(false);
  const [isAdminCampaign, setIsAdminCampaign] = useState(false);
  const { token } = useAuth();
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        console.log("⏳ Fetching campaign status for ID:", campaignId);
  
        const res1 = await fetch(`${API_BASE}/api/campaign/finished_today`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId }),
        });
        const finishedData = await res1.json();
        console.log("✅ finished_today response:", finishedData);
  
        const res2 = await fetch(`${API_BASE}/api/campaign/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId }),
        });
        const progress = await res2.json();
        console.log("✅ progress response:", progress);
  
        const now = new Date();
        const nowCT = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  
        const isFinalDay = progress.day >= progress.total;
        const pastCutoff = nowCT.getHours() >= 20;
        const inferredEnd = isFinalDay && (finishedData.ended || pastCutoff);
  
        console.log("📌 isFinalDay:", isFinalDay, "pastCutoff:", pastCutoff, "inferredEnd:", inferredEnd);
  
        setHasEnded(inferredEnd);
        setIsAdminCampaign(Boolean(progress?.is_admin_campaign));
      } catch (err) {
        console.error("❌ Error during fetchStatus:", err);
      } finally {
        console.log("✅ Setting statusLoaded to true");
        setStatusLoaded(true);
      }
    };
  
    if (campaignId && token) fetchStatus();
  }, [campaignId, token]);
  
  
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!campaignId) return;
  
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id: campaignId }),
        });
  
        const leaderboardData = await res.json();
        setData(leaderboardData); // only set data here
  
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };
  
    fetchLeaderboard();
  }, [campaignId]);
  
  useEffect(() => {
  
    if (hasEnded && Array.isArray(data) && data.length > 0) {
      const sorted = [...data].sort((a, b) => b.score - a.score);
      setDeclaredWinner(sorted[0]);
    } else {
      setDeclaredWinner(null);
    }
  }, [hasEnded, data, statusLoaded, loading]);
  
  
  
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
        backgroundColor: data.map((entry) => colorMap[entry.username]),
        borderColor: '#222',
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: { display: false },
    },
  };
  
  
  if (loading || !statusLoaded) {
    return (
      <div
        className={`leaderboard-background${isAdminCampaign ? " admin-theme" : ""}`}
        style={{
          backgroundImage: isAdminCampaign
            ? "radial-gradient(circle at top, #5b1111 0%, #2a0707 55%, #160404 100%)"
            : `url(${defaultBackground})`
        }}
      >
        <div className="loading-screen">
          <div className="swords-animation">
            <img src={require('../assets/ui/sword.png')} alt="Left Sword" className="sword left-sword" />
            <img src={require('../assets/ui/sword.png')} alt="Right Sword" className="sword right-sword" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={`leaderboard-background${isAdminCampaign ? " admin-theme" : ""}`}
      style={{
        backgroundImage: isAdminCampaign
          ? "radial-gradient(circle at top, #5b1111 0%, #2a0707 55%, #160404 100%)"
          : `url(${hasEnded && declaredWinner ? throneBackground : defaultBackground})`,
      }}
    >  
      {statusLoaded && hasEnded && declaredWinner !== null ? (
        <div className="declared-winner-screen">
          <div className="winner-content">
            <h1>👑 Declared Ruler</h1>
            <h2>{declaredWinner.username}</h2>
            <p>🏅 Troops: {declaredWinner.score}</p>
  
            <div className="loser-rankings">
              <h3>Subject Rankings</h3>
              <ol>
                {data
                  .filter(p => p.username !== declaredWinner.username)
                  .sort((a, b) => b.score - a.score)
                  .map((player, i) => (
                    <li key={i}>
                      {player.username} — {player.score} troops
                    </li>
                  ))}
              </ol>
            </div>
  
            <button className="back-button" onClick={() => navigate(-1)}>
              Back
            </button>
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
                  <th><span style={{ whiteSpace: 'nowrap' }}>Players</span></th>
                  <th><span style={{ whiteSpace: 'nowrap' }}>Troops</span></th>
                  <th><span style={{ whiteSpace: 'nowrap' }}>Battled?</span></th>
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
                        <span className="player-name">{entry.username}</span>
                      </td>
                      <td className="center-cell">{entry.score}</td>
                      <td style={{ textAlign: "center" }}>
                        {entry.played_today ? "✅" : "❌"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="back-button" onClick={() => navigate(-1)}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
}
