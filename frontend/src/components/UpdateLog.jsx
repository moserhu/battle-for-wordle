import React from 'react';

export default function UpdateLog() {
  return (
    <ul className="update-list">
      <li>
        <div className="update-title">⚔️ Double Down Feature</div>
        <p>
          • After your first guess, you may invoke the Double Down challenge. Should you accept,
          you will have only <strong>3 total guesses</strong> to conquer the word. Victory shall
          reward you with <strong>double the troops</strong> if claimed within the first three
          attempts. But beware — failure will bring shame, and your current troop count will be
          <strong> halved</strong>. Will you risk it all for glory?
        </p>
        <p>• Double Down can only be used once per campaign</p>
      </li>

      <li>
        <div className="update-title">Failure Display</div>
        <p>• Added display to show secret word on loss</p>
      </li>

      <li>
        <div className="update-title">Scoring Change</div>
        <p>• Scoring has been adjusted to be more competitive. The new scoring system is as follows:</p>
        <ul>
          <li>1st Guess: 150 Troops</li>
          <li>2nd Guess: 100 Troops</li>
          <li>3rd Guess: 60 Troops</li>
          <li>4th Guess: 40 Troops</li>
          <li>5th Guess: 30 Troops</li>
          <li>6th Guess: 10 Troops</li>
        </ul>
      </li>
    </ul>
  );
}
