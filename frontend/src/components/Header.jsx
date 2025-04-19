export default function Header({ campaignDay, countdown, onToggleLeaderboard }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
      <h1>Battle for Wordle</h1>
      {campaignDay && (
        <p style={{ fontSize: '18px', color: '#aaa' }}>
          Day {campaignDay.day} of {campaignDay.total} • Campaign: <strong>{campaignDay.name}</strong>
        </p>
      )}
      <p style={{ fontSize: '16px', color: '#bbb' }}>
        ⏳ Next word in: {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
      </p>
      <button
        style={{ marginTop: '10px' }}
        onClick={onToggleLeaderboard}
      >
        View Leaderboard
      </button>
    </div>
  );
}
