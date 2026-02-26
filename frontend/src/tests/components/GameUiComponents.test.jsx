import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import HubBar from '../../components/HubBar';
import Keyboard from '../../components/Keyboard';
import WordGrid from '../../components/WordGrid';

jest.mock('../../components/DoubleDownModal', () => (props) => (
  props.visible ? (
    <div data-testid="double-down-info">
      <button type="button" onClick={props.onDecline}>Close DD</button>
    </div>
  ) : null
));

jest.mock('../../components/CoinsInfoModal', () => (props) => (
  props.visible ? (
    <div data-testid="coins-info">
      <button type="button" onClick={props.onClose}>Close Coins</button>
    </div>
  ) : null
));

jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => <span data-testid="coin-icon" />,
}));

describe('Game UI components', () => {
  test('HubBar renders countdown/state and opens info modals', () => {
    const onBattle = jest.fn();
    const onInventory = jest.fn();
    const onShop = jest.fn();
    const onStreakInfo = jest.fn();

    render(
      <HubBar
        cutoffCountdown={{ hours: 0, minutes: 5, seconds: 9 }}
        midnightCountdown={{ hours: 3, minutes: 12, seconds: 0 }}
        isFinalDay
        campaignEnded={false}
        coins={12}
        doubleDownUsed={false}
        doubleDownActivated
        onBattle={onBattle}
        onInventory={onInventory}
        onShop={onShop}
        streak={2}
        onStreakInfo={onStreakInfo}
      />
    );

    expect(screen.getByText(/ends in/i)).toBeInTheDocument();
    expect(screen.getByText(/5m 9s/i)).toBeInTheDocument();
    expect(screen.getByText(/not complete/i)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enter battlefield/i }));
    fireEvent.click(screen.getByRole('button', { name: /inventory/i }));
    fireEvent.click(screen.getByRole('button', { name: /market/i }));
    fireEvent.click(screen.getByRole('button', { name: /streak/i }));
    expect(onBattle).toHaveBeenCalled();
    expect(onInventory).toHaveBeenCalled();
    expect(onShop).toHaveBeenCalled();
    expect(onStreakInfo).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /available|active|used/i }));
    expect(screen.getByTestId('double-down-info')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close dd/i }));
    expect(screen.queryByTestId('double-down-info')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /coins info/i }));
    expect(screen.getByTestId('coins-info')).toBeInTheDocument();
  });

  test('Keyboard applies statuses, blocks sealed/void letters, and forwards key presses', () => {
    const onKeyPress = jest.fn();
    const danceStyle = jest.fn(() => ({ transform: 'rotate(1deg)' }));

    render(
      <Keyboard
        onKeyPress={onKeyPress}
        letterStatus={{ a: 'correct', b: 'present', c: 'absent' }}
        className="extra"
        jesterDance
        jesterSeed={1}
        getJesterDanceStyle={danceStyle}
        sealedLetter="d"
        voidLetters={['e']}
        cartographerLetters={['f']}
      />
    );

    expect(screen.getByRole('button', { name: 'A' }).className).toMatch(/correct/);
    expect(screen.getByRole('button', { name: 'B' }).className).toMatch(/present/);
    expect(screen.getByRole('button', { name: 'C' }).className).toMatch(/absent/);
    expect(screen.getByRole('button', { name: 'D' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'E' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'F' }).className).toMatch(/cartographer-letter/);

    fireEvent.click(screen.getByRole('button', { name: 'Q' }));
    expect(onKeyPress).toHaveBeenCalledWith('Q');
    expect(danceStyle).toHaveBeenCalled();
  });

  test('WordGrid renders result colors, edict label, active cell, and grayed rows', () => {
    const guesses = [
      ['C', 'R', 'A', 'N', 'E'],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
    ];
    const results = [
      ['correct', 'present', 'absent', 'absent', 'correct'],
      null,
      null,
    ];

    const { container } = render(
      <WordGrid
        guesses={guesses}
        results={results}
        currentRow={1}
        currentCol={0}
        maxVisibleRows={2}
        correctColor="#123456"
        edictRow={0}
        executionerRow={1}
        edictSender="Ruler"
      />
    );

    expect(screen.getByText(/ruler/i)).toBeInTheDocument();
    const rows = container.querySelectorAll('.word-row');
    expect(rows[0].className).toMatch(/edict-row/);
    expect(rows[1].className).toMatch(/executioner-row/);
    expect(rows[2].style.opacity).toBe('0.3');
    const cells = container.querySelectorAll('.letter-box');
    expect(Array.from(cells).some((c) => c.style.backgroundColor === 'rgb(18, 52, 86)')).toBe(true);
    expect(Array.from(cells).some((c) => c.style.boxShadow.includes('rgba'))).toBe(true);
  });
});
