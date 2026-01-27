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
  const [previewPlayer, setPreviewPlayer] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 999
  );

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
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
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

  const getNameSizeClass = (name) => {
    if (!name) return '';
    const words = String(name).trim().split(/\s+/);
    const longest = words.reduce((max, w) => Math.max(max, w.length), 0);
    const total = words.join('').length;
    const isSmallScreen = viewportWidth <= 420;
    if (isSmallScreen && (longest >= 9 || total >= 12)) return 'player-name--small';
    if (longest >= 18 || total >= 26) return 'player-name--xxsmall';
    if (longest >= 15 || total >= 22) return 'player-name--xsmall';
    if (longest >= 11 || total >= 16) return 'player-name--small';
    return '';
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
                          className="player-card"
                          role="button"
                          tabIndex={0}
                          onClick={() => setPreviewPlayer(entry)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setPreviewPlayer(entry);
                            }
                          }}
                          style={{ '--player-color': colorMap[entry.username] || '#2b2b2b' }}
                        >
                          <div className="player-media">
                            <div className="player-avatar">
                              {entry.profile_image_thumb_url || entry.profile_image_url ? (
                                <img src={entry.profile_image_thumb_url || entry.profile_image_url} alt="" />
                              ) : (
                                <span>?</span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`player-name ${getNameSizeClass(entry.username)}`}
                            style={{ color: '#ffffff' }}
                          >
                            {entry.username}
                          </span>
                        </div>
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
      {previewPlayer && (
        <div className="player-preview-overlay" onClick={() => setPreviewPlayer(null)}>
          <div
            className="player-preview-card"
            style={{
              backgroundImage: (previewPlayer.army_image_full_url || previewPlayer.army_image_url || previewPlayer.army_image_thumb_url)
                ? `url(${previewPlayer.army_image_full_url || previewPlayer.army_image_url || previewPlayer.army_image_thumb_url})`
                : undefined,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (previewPlayer.army_image_full_url || previewPlayer.army_image_url || previewPlayer.army_image_thumb_url) {
                setPreviewImageUrl(
                  previewPlayer.army_image_full_url || previewPlayer.army_image_url || previewPlayer.army_image_thumb_url
                );
              }
            }}
          >
            <button
              className="player-preview-close"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewPlayer(null);
              }}
              type="button"
            >
              ×
            </button>
            <div className="player-preview-avatar">
              {previewPlayer.profile_image_full_url || previewPlayer.profile_image_url || previewPlayer.profile_image_thumb_url ? (
                <img
                  src={previewPlayer.profile_image_full_url || previewPlayer.profile_image_url || previewPlayer.profile_image_thumb_url}
                  alt=""
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImageUrl(
                      previewPlayer.profile_image_full_url || previewPlayer.profile_image_url || previewPlayer.profile_image_thumb_url
                    );
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setPreviewImageUrl(
                        previewPlayer.profile_image_full_url || previewPlayer.profile_image_url || previewPlayer.profile_image_thumb_url
                      );
                    }
                  }}
                />
              ) : (
                <span>?</span>
              )}
            </div>
            <div
              className="player-preview-name"
            >
              {previewPlayer.username}
            </div>
            <div className="player-preview-army-name">
              {previewPlayer.army_name || "Unnamed Army"}
            </div>
          </div>
        </div>
      )}
      {previewImageUrl && (
        <div className="player-image-overlay" onClick={() => setPreviewImageUrl("")}>
          <div className="player-image-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="player-image-close"
              type="button"
              onClick={() => setPreviewImageUrl("")}
            >
              ×
            </button>
            <img src={previewImageUrl} alt="Player preview" />
          </div>
        </div>
      )}
    </div>
  );
  
}
