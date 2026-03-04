import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GameScreen from '../../pages/GameScreen';

const mockNavigate = jest.fn();
let mockLocationSearch = '?campaign_id=42';
let mockAuthState = {
  user: { user_id: 42, is_admin: false },
  token: 'token',
  isAuthenticated: true,
  loading: false,
};

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: mockLocationSearch }),
}), { virtual: true });

jest.mock('canvas-confetti', () => jest.fn());

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

jest.mock('../../components/WordGrid', () => (props) => (
  <div data-testid="word-grid">
    <div data-testid="grid-current-row">{props.currentRow}</div>
    <div data-testid="grid-current-col">{props.currentCol}</div>
    <div data-testid="grid-row-0">{(props.guesses?.[0] || []).join('')}</div>
    <div data-testid="grid-row-1">{(props.guesses?.[1] || []).join('')}</div>
    <div data-testid="grid-obscured-side">{props.obscuredSightSide || ''}</div>
    <div data-testid="grid-obscured-active">{String(Boolean(props.obscuredSightActive))}</div>
  </div>
));

jest.mock('../../components/Keyboard', () => function MockKeyboard({
  onKeyPress,
  cursedLetters = [],
  obscuredSightSide = null,
  obscuredSightActive = false,
}) {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ];
  const cursedSet = new Set(cursedLetters.map((letter) => String(letter).toUpperCase()));
  const isVeilBlocked = (row, colIndex, key) => {
    if (!obscuredSightActive || (obscuredSightSide !== 'left' && obscuredSightSide !== 'right')) {
      return false;
    }
    if (obscuredSightSide === 'left' && key === 'Enter') return false;
    if (obscuredSightSide === 'right' && key === '⌫') return false;
    const midpoint = (row.length - 1) / 2;
    return obscuredSightSide === 'left' ? colIndex < midpoint : colIndex > midpoint;
  };

  return (
    <div data-testid="keyboard">
      {rows.flatMap((row) =>
        row.map((key, colIndex) => {
          const veilBlocked = isVeilBlocked(row, colIndex, key);
          return (
            <button
              key={key}
              type="button"
              className={`${cursedSet.has(key) ? 'cursed-letter' : ''} ${veilBlocked ? 'veil-obscured-key' : ''}`.trim()}
              onClick={() => onKeyPress(key)}
            >
              {key}
            </button>
          );
        }),
      )}
    </div>
  );
});

jest.mock('../../components/DoubleDownModal', () => ({ visible }) => (
  visible ? <div data-testid="double-down-modal" /> : null
));
jest.mock('../../components/RulerTitleModal', () => () => null);
jest.mock('../../components/DayReplayInfoModal', () => () => null);
jest.mock('../../components/admin/AdminToolsModal', () => () => null);

jest.mock('../../components/rewards/WeeklyRewardModal', () => function MockWeeklyRewardModal(props) {
  if (!props.visible) return null;
  return (
    <div data-testid="weekly-reward-modal">
      <div>{props.title}</div>
      <div>{props.description}</div>
      <div data-testid="weekly-error">{props.error}</div>
      <div>
        {(props.candidates || []).map((candidate) => (
          <button
            key={candidate.user_id}
            type="button"
            onClick={() => props.onToggle(candidate.user_id)}
          >
            Toggle {candidate.user_id}
          </button>
        ))}
      </div>
      <button type="button" onClick={props.onConfirm}>
        {props.confirmLabel || 'Confirm'}
      </button>
    </div>
  );
});

jest.mock('../../components/items/blessings', () => ({
  applyAbsentLetters: (prev) => prev,
  getCartographersLetters: () => [],
  applyOracleCorrectLetter: (prev, letter) => ({ ...prev, [String(letter).toLowerCase()]: 'correct' }),
  getOraclePlacement: () => null,
  hasCandleOfMercy: () => false,
}));

jest.mock('../../components/items/illusions', () => ({
  hasBloodOathInk: () => false,
  useClownJumpscare: () => ({ showClownOverlay: false, triggerClown: jest.fn() }),
  ClownOverlay: () => null,
  useSpiderSwarm: () => ({ active: false, spiders: [] }),
  getSpiderMotionProps: () => ({}),
  useJesterDance: () => ({ active: false, seed: 0, getStyle: () => ({}) }),
  getConeTurns: () => 0,
  decrementConeTurns: (n) => Math.max(0, Number(n || 0) - 1),
  shouldShowConeOverlay: () => false,
  getConeOpacity: () => 0,
  hasTimeStop: () => false,
  TIME_STOP_REVEAL_DELAY_MS: 1200,
  WanderingGlyphOverlay: ({ targetEffects }) =>
    targetEffects.some((entry) => entry.item_key === 'sigil_of_the_wandering_glyph')
      ? <div data-testid="wandering-glyph" />
      : null,
}));

jest.mock('../../components/items/curses', () => ({
  hasExecutionersCut: () => false,
}));

function makeResponse(json, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => json,
  };
}

function emptyGrid() {
  return Array.from({ length: 6 }, () => Array(5).fill(''));
}

function createFetchMock(overrides = {}) {
  const calls = [];
  const queues = {
    '/api/campaign/progress': [
      makeResponse({
        day: 2,
        total: 7,
        name: 'Test Campaign',
        king: 'Queen Test',
        ruler_id: 99,
        is_admin_campaign: false,
        ruler_title: 'Current Ruler',
      }),
    ],
    '/api/game/state': [
      makeResponse({
        guesses: emptyGrid(),
        results: Array(6).fill(null),
        letter_status: {},
        game_over: false,
        current_row: 0,
        word: null,
      }),
    ],
    '/api/campaign/self_member': [
      makeResponse({}),
      makeResponse({ double_down_activated: 0, double_down_used_week: 0 }),
    ],
    '/api/campaign/items/hint': [makeResponse({})],
    '/api/campaign/items/active': [makeResponse({ effects: [] })],
    '/api/campaign/items/status': [makeResponse({ effects: [] })],
    '/api/campaign/shop/state': [],
    '/api/campaign/items/use': [],
    '/api/guess': [],
    '/api/campaign/rewards/pending': [makeResponse({ pending: false })],
    '/api/campaign/rewards/choose': [],
    '/api/campaign/finished_today': [makeResponse({ ended: false })],
    '/api/campaign/end': [makeResponse({ ok: true })],
    '/api/double_down': [makeResponse({ ok: true })],
    ...overrides,
  };
  const repeatablePaths = new Set([
    '/api/campaign/progress',
    '/api/game/state',
    '/api/campaign/self_member',
    '/api/campaign/items/hint',
    '/api/campaign/items/active',
    '/api/campaign/items/status',
    '/api/campaign/rewards/pending',
    '/api/campaign/finished_today',
  ]);
  const lastResponseByPath = {};

  const fetchMock = jest.fn(async (url, options = {}) => {
    const pathname = new URL(String(url), window.location.origin).pathname;
    calls.push({ pathname, options });
    const queue = queues[pathname];
    if (queue && queue.length > 0) {
      const next = queue.shift();
      lastResponseByPath[pathname] = next;
      return typeof next === 'function' ? next({ pathname, options, calls }) : next;
    }
    if (repeatablePaths.has(pathname) && lastResponseByPath[pathname]) {
      const next = lastResponseByPath[pathname];
      return typeof next === 'function' ? next({ pathname, options, calls }) : next;
    }
    if (!queue || queue.length === 0) {
      throw new Error(`Unhandled fetch for ${pathname}`);
    }
  });

  fetchMock.callsByPath = (pathname) => calls.filter((call) => call.pathname === pathname);
  fetchMock.lastCallByPath = (pathname) => {
    const filtered = fetchMock.callsByPath(pathname);
    return filtered[filtered.length - 1];
  };
  return fetchMock;
}

async function waitForInitialLoad(dayLabel = /day 2 of 7/i) {
  expect(await screen.findByText(dayLabel)).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByText(/loading day/i)).not.toBeInTheDocument();
  });
}

describe('GameScreen page', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLocationSearch = '?campaign_id=42';
    mockAuthState = {
      user: { user_id: 42, is_admin: false },
      token: 'token',
      isAuthenticated: true,
      loading: false,
    };
    global.fetch = createFetchMock();
    window.alert = jest.fn();
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: jest.fn() },
      });
    } else {
      navigator.clipboard.writeText = jest.fn();
    }
    navigator.share = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('redirects to login when user is not authenticated', async () => {
    mockAuthState = {
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
    };

    render(<GameScreen />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  test('navigates home when campaign_id is missing from query string', async () => {
    mockLocationSearch = '';

    render(<GameScreen />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  test('loads initial day state and shows current-day oracle hint banner', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/progress': [
        makeResponse({
          day: 2,
          total: 7,
          name: 'Campaign A',
          king: 'Ruler Name',
          ruler_id: 42,
          is_admin_campaign: false,
          ruler_title: 'Royal Orders',
        }),
      ],
      '/api/campaign/items/hint': [
        makeResponse({ hint: { letter: 'K', position: 3 } }),
      ],
    });

    render(<GameScreen />);

    await waitForInitialLoad();
    expect(screen.getByText(/ruler name/i)).toBeInTheDocument();
    const hintBanner = screen.getByText(/oracle's whisper/i).closest('.game-hint-banner');
    expect(hintBanner).toBeInTheDocument();
    expect(screen.getByText(/letter/i)).toBeInTheDocument();
    expect(hintBanner).toHaveTextContent('K');
    expect(hintBanner).toHaveTextContent('3');
  });

  test('resets selected day when switching campaigns', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/progress': [
        makeResponse({
          day: 2,
          total: 7,
          name: 'Campaign A',
          king: 'Ruler A',
          ruler_id: 42,
          is_admin_campaign: false,
          ruler_title: 'Current Ruler',
        }),
        makeResponse({
          day: 7,
          total: 10,
          name: 'Campaign B',
          king: 'Ruler B',
          ruler_id: 77,
          is_admin_campaign: false,
          ruler_title: 'Current Ruler',
        }),
      ],
      '/api/game/state': [
        makeResponse({
          guesses: emptyGrid(),
          results: Array(6).fill(null),
          letter_status: {},
          game_over: false,
          current_row: 0,
          word: null,
        }),
        makeResponse({
          guesses: emptyGrid(),
          results: Array(6).fill(null),
          letter_status: {},
          game_over: false,
          current_row: 0,
          word: null,
        }),
      ],
    });

    const { rerender } = render(<GameScreen />);
    await waitForInitialLoad(/day 2 of 7/i);

    mockLocationSearch = '?campaign_id=99';
    rerender(<GameScreen />);

    await waitForInitialLoad(/day 7 of 10/i);
    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/game/state').length).toBeGreaterThanOrEqual(2);
    });
    const lastStateCall = global.fetch.lastCallByPath('/api/game/state');
    expect(JSON.parse(lastStateCall.options.body)).toEqual({ campaign_id: 99, day: 7 });
  });

  test('opens inventory modal and filters to self-use items with positive quantity', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/shop/state': [
        makeResponse({
          items: [
            { key: 'oracle_whisper', name: "Oracle's Whisper", requires_target: false, payload_type: 'letter', description: 'Hint' },
            { key: 'hex_of_compulsion', name: 'Hex of Forced Utterance', requires_target: true, description: 'Targeted' },
            { key: 'candle_of_mercy', name: 'Candle of Mercy', requires_target: false, description: 'Mercy' },
          ],
          inventory: [
            { item_key: 'oracle_whisper', quantity: 2 },
            { item_key: 'hex_of_compulsion', quantity: 1 },
            { item_key: 'candle_of_mercy', quantity: 0 },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    fireEvent.click(screen.getByRole('button', { name: /use items/i }));

    expect(await screen.findByText(/inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/oracle's whisper/i)).toBeInTheDocument();
    expect(screen.queryByText(/hex of forced utterance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/candle of mercy/i)).not.toBeInTheDocument();
  });

  test('blocks self-item use when required payload is missing', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/shop/state': [
        makeResponse({
          items: [
            { key: 'oracle_whisper', name: "Oracle's Whisper", requires_target: false, payload_type: 'letter', description: 'Hint' },
          ],
          inventory: [
            { item_key: 'oracle_whisper', quantity: 1 },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    fireEvent.click(screen.getByRole('button', { name: /use items/i }));
    await screen.findByText(/oracle's whisper/i);

    fireEvent.click(screen.getByRole('button', { name: /^use$/i }));

    expect(await screen.findByText(/choose a single letter before using this item/i)).toBeInTheDocument();
    expect(global.fetch.callsByPath('/api/campaign/items/use')).toHaveLength(0);
  });

  test('uses self item with normalized payload and refreshes inventory/effects', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/shop/state': [
        makeResponse({
          items: [
            { key: 'oracle_whisper', name: "Oracle's Whisper", requires_target: false, payload_type: 'letter', description: 'Hint' },
          ],
          inventory: [{ item_key: 'oracle_whisper', quantity: 1 }],
        }),
        makeResponse({
          items: [
            { key: 'oracle_whisper', name: "Oracle's Whisper", requires_target: false, payload_type: 'letter', description: 'Hint' },
          ],
          inventory: [],
        }),
      ],
      '/api/campaign/items/use': [makeResponse({ ok: true })],
      '/api/campaign/items/hint': [
        makeResponse({}), // initial load
        makeResponse({ hint: { letter: 'Q', position: 1 } }), // refreshSelfEffects after use
      ],
      '/api/campaign/items/active': [
        makeResponse({ effects: [] }),
        makeResponse({ effects: [] }),
      ],
      '/api/campaign/items/status': [
        makeResponse({ effects: [] }),
        makeResponse({ effects: [] }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    fireEvent.click(screen.getByRole('button', { name: /use items/i }));
    await screen.findByText(/oracle's whisper/i);

    fireEvent.change(screen.getByPlaceholderText(/letter/i), { target: { value: 'Q' } });
    fireEvent.click(screen.getByRole('button', { name: /^use$/i }));

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/campaign/items/use')).toHaveLength(1);
    });

    const useCall = global.fetch.lastCallByPath('/api/campaign/items/use');
    const parsedBody = JSON.parse(useCall.options.body);
    expect(parsedBody).toMatchObject({
      campaign_id: 42,
      item_key: 'oracle_whisper',
      target_user_id: null,
      effect_payload: { value: 'q' },
    });

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/campaign/shop/state')).toHaveLength(2);
    });
  });

  test('validates weekly reward recipient count before submit and posts selected recipients', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/progress': [
        makeResponse({
          day: 1,
          total: 7,
          name: 'Campaign A',
          king: 'Ruler',
          ruler_id: 42,
          is_admin_campaign: false,
          ruler_title: 'Current Ruler',
        }),
      ],
      '/api/campaign/rewards/pending': [
        makeResponse({
          pending: true,
          recipient_count: 2,
          whispers_per_recipient: 1,
          candidates: [
            { user_id: 11, display_name: 'One' },
            { user_id: 12, display_name: 'Two' },
            { user_id: 13, display_name: 'Three' },
          ],
        }),
      ],
      '/api/campaign/rewards/choose': [makeResponse({ ok: true })],
    });

    render(<GameScreen />);

    expect(await screen.findByTestId('weekly-reward-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm picks/i }));
    expect(await screen.findByText(/pick exactly 2 players/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /toggle 11/i }));
    fireEvent.click(screen.getByRole('button', { name: /toggle 12/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm picks/i }));

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/campaign/rewards/choose')).toHaveLength(1);
    });

    const chooseCall = global.fetch.lastCallByPath('/api/campaign/rewards/choose');
    expect(JSON.parse(chooseCall.options.body)).toEqual({
      campaign_id: 42,
      recipient_user_ids: [11, 12],
    });

    await waitFor(() => {
      expect(screen.queryByTestId('weekly-reward-modal')).not.toBeInTheDocument();
    });
  });

  test('prevents duplicate guesses client-side before posting to guess API', async () => {
    const guesses = emptyGrid();
    guesses[0] = ['C', 'R', 'A', 'N', 'E'];
    global.fetch = createFetchMock({
      '/api/game/state': [
        makeResponse({
          guesses,
          results: [
            ['absent', 'absent', 'absent', 'absent', 'absent'],
            null, null, null, null, null,
          ],
          letter_status: {},
          game_over: false,
          current_row: 1,
          word: null,
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    for (const key of ['C', 'R', 'A', 'N', 'E', 'Enter']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await waitFor(() => {
      expect(document.querySelector('.grid-outer.shake')).toBeTruthy();
    });
    expect(screen.getByTestId('grid-current-row')).toHaveTextContent('1');
    expect(global.fetch.callsByPath('/api/guess')).toHaveLength(0);
  });

  test('shows invalid word error when guess endpoint returns 204', async () => {
    global.fetch = createFetchMock({
      '/api/guess': [
        {
          ok: false,
          status: 204,
          json: async () => {
            throw new Error('json should not be read for 204');
          },
        },
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    for (const key of ['C', 'R', 'A', 'N', 'E', 'Enter']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await waitFor(() => {
      expect(document.querySelector('.grid-outer.shake')).toBeTruthy();
    });
    expect(screen.getByTestId('grid-current-row')).toHaveTextContent('0');
    expect(screen.getByTestId('grid-row-0')).toHaveTextContent('CRANE');
    expect(global.fetch.callsByPath('/api/guess')).toHaveLength(1);
  });

  test('does not open double down modal on load when forced utterance alias is active', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/self_member': [
        makeResponse({}),
        makeResponse({ double_down_activated: 1, double_down_used_week: 0 }),
      ],
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'edict_of_compulsion',
              details: { payload: { value: 'crane' }, sender_name: 'Hex Caster' },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.queryByTestId('double-down-modal')).not.toBeInTheDocument();
  });

  test('does not open double down modal on load and opens after first guess in normal flow', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/self_member': [
        makeResponse({}),
        makeResponse({ double_down_activated: 0, double_down_used_week: 0 }),
      ],
      '/api/guess': [
        makeResponse({
          result: ['absent', 'absent', 'absent', 'absent', 'absent'],
          word: 'cigar',
          clown_triggered: false,
          infernal_penalty_applied: 0,
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.queryByTestId('double-down-modal')).not.toBeInTheDocument();

    for (const key of ['C', 'R', 'A', 'N', 'E', 'Enter']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/guess')).toHaveLength(1);
    });
    expect(await screen.findByTestId('double-down-modal')).toBeInTheDocument();
  });

  test('does not open double down modal on reload when guesses already started', async () => {
    const guesses = emptyGrid();
    guesses[0] = ['C', 'R', 'A', 'N', 'E'];
    guesses[1] = ['B', 'L', 'I', 'N', 'K'];
    global.fetch = createFetchMock({
      '/api/game/state': [
        makeResponse({
          guesses,
          results: [
            ['absent', 'absent', 'absent', 'absent', 'absent'],
            ['absent', 'absent', 'absent', 'absent', 'absent'],
            null, null, null, null,
          ],
          letter_status: {},
          game_over: false,
          current_row: 2,
          word: null,
        }),
      ],
      '/api/campaign/self_member': [
        makeResponse({}),
        makeResponse({ double_down_activated: 0, double_down_used_week: 0 }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();
    await waitFor(() => {
      expect(screen.getByTestId('grid-current-row')).toHaveTextContent('2');
    });
    expect(screen.queryByTestId('double-down-modal')).not.toBeInTheDocument();
  });

  test('does not open double down modal after forced utterance auto-submits a guess', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/self_member': [
        makeResponse({}),
        makeResponse({ double_down_activated: 0, double_down_used_week: 0 }),
      ],
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'hex_of_compulsion',
              details: { payload: { value: 'crane' }, sender_name: 'Hex Caster' },
            },
          ],
        }),
      ],
      '/api/guess': [
        makeResponse({
          result: ['absent', 'absent', 'absent', 'absent', 'absent'],
          word: 'cigar',
          clown_triggered: false,
          infernal_penalty_applied: 0,
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/guess')).toHaveLength(1);
    });
    expect(screen.queryByTestId('double-down-modal')).not.toBeInTheDocument();
  });

  test('opens double down modal after next guess when forced utterance is active and row one is reached', async () => {
    const guesses = emptyGrid();
    guesses[0] = ['C', 'R', 'A', 'N', 'E'];
    global.fetch = createFetchMock({
      '/api/game/state': [
        makeResponse({
          guesses,
          results: [
            ['absent', 'absent', 'absent', 'absent', 'absent'],
            null, null, null, null, null,
          ],
          letter_status: {},
          game_over: false,
          current_row: 1,
          word: null,
        }),
      ],
      '/api/campaign/self_member': [
        makeResponse({}),
        makeResponse({ double_down_activated: 0, double_down_used_week: 0 }),
      ],
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'hex_of_compulsion',
              details: { payload: { value: 'crane' }, sender_name: 'Hex Caster' },
            },
          ],
        }),
      ],
      '/api/guess': [
        makeResponse({
          result: ['absent', 'absent', 'absent', 'absent', 'absent'],
          word: 'cigar',
          clown_triggered: false,
          infernal_penalty_applied: 0,
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    await waitFor(() => {
      expect(screen.getByTestId('grid-current-row')).toHaveTextContent('1');
      expect(screen.getByTestId('grid-current-col')).toHaveTextContent('0');
    });
    expect(screen.queryByTestId('double-down-modal')).not.toBeInTheDocument();

    for (const key of ['B', 'L', 'I', 'N', 'K']) {
      fireEvent.keyDown(window, { key });
    }
    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/guess')).toHaveLength(1);
    });
    expect(await screen.findByTestId('double-down-modal')).toBeInTheDocument();
  });

  test('shows infernal troop-loss modal for invalid non-playable words', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'infernal_mandate',
              details: { sender_name: 'Infernal Judge' },
            },
          ],
        }),
      ],
      '/api/guess': [
        makeResponse(
          {
            detail: {
              message: 'Invalid word',
              infernal_penalty_applied: 5,
              infernal_rule_broken: true,
              infernal_violation_type: 'playable_word',
            },
          },
          { ok: false, status: 400 },
        ),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    for (const key of ['C', 'R', 'A', 'N', 'E', 'Enter']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/guess')).toHaveLength(1);
    });
    expect(await screen.findByText(/you lost/i)).toBeInTheDocument();
    expect(screen.getByText(/you must play a playable word or risk losing/i).closest('p')).toHaveTextContent(/5 more troops/i);
  });

  test('shows curse hex button and modal details when player is cursed', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'vowel_voodoo',
              details: {
                sender_name: 'TheNightKing',
                payload: { value: 'ae' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    const curseButton = screen.getByRole('button', { name: /curse details/i });
    expect(curseButton).toBeInTheDocument();

    fireEvent.click(curseButton);

    expect(await screen.findByText(/hex mark detected/i)).toBeInTheDocument();
    expect(screen.getByText(/theNightKing/i)).toBeInTheDocument();
    expect(screen.getByText(/vowel voodoo/i)).toBeInTheDocument();
    expect(screen.getByText(/effect:/i).closest('p')).toHaveTextContent(/vowels a, e are blocked/i);
  });

  test('highlights obscured sight side payload in curse modal', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'blinding_brew',
              details: {
                sender_name: 'FogCaller',
                payload: { value: 'left' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    fireEvent.click(screen.getByRole('button', { name: /curse details/i }));
    expect(await screen.findByText(/hex mark detected/i)).toBeInTheDocument();
    const emphasized = document.querySelector('.curse-info-effect-emphasis');
    expect(emphasized).toBeTruthy();
    expect(emphasized).toHaveTextContent('LEFT');
    expect(screen.getByText(/effect:/i).closest('p')).toHaveTextContent(/left columns are obscured/i);
  });

  test('applies obscured sight board effect to selected side during first two guesses', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'blinding_brew',
              details: {
                sender_name: 'FogCaller',
                payload: { value: 'right' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.getByTestId('grid-obscured-side')).toHaveTextContent('right');
    expect(screen.getByTestId('grid-obscured-active')).toHaveTextContent('true');
  });

  test('does not apply obscured sight board effect after the second guess row', async () => {
    global.fetch = createFetchMock({
      '/api/game/state': [
        makeResponse({
          guesses: emptyGrid(),
          results: Array(6).fill(null),
          letter_status: {},
          game_over: false,
          current_row: 2,
          word: null,
        }),
      ],
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'blinding_brew',
              details: {
                sender_name: 'FogCaller',
                payload: { value: 'left' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.getByTestId('grid-obscured-side')).toHaveTextContent('left');
    expect(screen.getByTestId('grid-obscured-active')).toHaveTextContent('false');
  });

  test('left obscured sight keeps Enter and blacked keys usable', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'blinding_brew',
              details: {
                sender_name: 'FogCaller',
                payload: { value: 'left' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    const enterKey = screen.getByRole('button', { name: 'Enter' });
    const leftKey = screen.getByRole('button', { name: 'Q' });
    expect(enterKey).not.toBeDisabled();
    expect(leftKey).not.toBeDisabled();
    expect(leftKey).toHaveClass('veil-obscured-key');

    fireEvent.click(leftKey);
    expect(screen.getByTestId('grid-row-0')).toHaveTextContent('Q');
  });

  test('right obscured sight keeps Delete and blacked keys usable', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'blinding_brew',
              details: {
                sender_name: 'FogCaller',
                payload: { value: 'right' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    const deleteKey = screen.getByRole('button', { name: '⌫' });
    const rightKey = screen.getByRole('button', { name: 'P' });
    expect(deleteKey).not.toBeDisabled();
    expect(rightKey).not.toBeDisabled();
    expect(rightKey).toHaveClass('veil-obscured-key');

    fireEvent.click(rightKey);
    expect(screen.getByTestId('grid-row-0')).toHaveTextContent('P');
  });

  test('shows new blessing status banners from status effects payloads', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/status': [
        makeResponse({
          effects: [
            { effect_key: 'vowel_vision', payload: { day: 2, vowel_count: 3 } },
            {
              effect_key: 'twin_fates',
              payload: {
                day: 2,
                letters: [
                  { letter: 'a', positions: [1, 4] },
                  { letter: 'e', positions: [2, 5] },
                ],
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.getByText(/god of the easy tongue/i)).toBeInTheDocument();
    expect(screen.getByText(/today's word has/i)).toBeInTheDocument();
    expect(screen.getByText(/twin fates/i)).toBeInTheDocument();
    expect(screen.getByText(/A at 1, 4 \| E at 2, 5/i)).toBeInTheDocument();
  });

  test('blocks hexed letters from vowel voodoo on early rows', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'vowel_voodoo',
              details: {
                sender_name: 'HexCaster',
                payload: { value: 'ae' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.getByRole('button', { name: 'A' })).toHaveClass('cursed-letter');

    fireEvent.click(screen.getByRole('button', { name: 'A' }));

    await waitFor(() => {
      expect(document.querySelector('.grid-outer.shake')).toBeTruthy();
    });
    expect(screen.getByTestId('grid-row-0')).toHaveTextContent('');
  });

  test('does not mark vowel voodoo letters after the second row', async () => {
    global.fetch = createFetchMock({
      '/api/game/state': [
        makeResponse({
          guesses: emptyGrid(),
          results: Array(6).fill(null),
          letter_status: {},
          game_over: false,
          current_row: 2,
          word: null,
        }),
      ],
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'vowel_voodoo',
              details: {
                sender_name: 'HexCaster',
                payload: { value: 'ae' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.getByRole('button', { name: 'A' })).not.toHaveClass('cursed-letter');
    expect(screen.getByRole('button', { name: 'E' })).not.toHaveClass('cursed-letter');
  });

  test('marks consonant cleaver blocked letters as cursed on the keyboard', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'consonant_cleaver',
              details: {
                sender_name: 'HexCaster',
                payload: { value: 'crne' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.getByRole('button', { name: 'C' })).toHaveClass('cursed-letter');
    expect(screen.getByRole('button', { name: 'R' })).toHaveClass('cursed-letter');
    expect(screen.getByRole('button', { name: 'N' })).toHaveClass('cursed-letter');
    expect(screen.getByRole('button', { name: 'E' })).toHaveClass('cursed-letter');
  });

  test('does not mark consonant cleaver letters after the second row', async () => {
    global.fetch = createFetchMock({
      '/api/game/state': [
        makeResponse({
          guesses: emptyGrid(),
          results: Array(6).fill(null),
          letter_status: {},
          game_over: false,
          current_row: 2,
          word: null,
        }),
      ],
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'consonant_cleaver',
              details: {
                sender_name: 'HexCaster',
                payload: { value: 'crne' },
              },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.getByRole('button', { name: 'C' })).not.toHaveClass('cursed-letter');
    expect(screen.getByRole('button', { name: 'R' })).not.toHaveClass('cursed-letter');
    expect(screen.getByRole('button', { name: 'N' })).not.toHaveClass('cursed-letter');
    expect(screen.getByRole('button', { name: 'E' })).not.toHaveClass('cursed-letter');
  });

  test('infernal mandate locks green letters and shows troop-loss modal on missing discovered letters', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'infernal_mandate',
              details: { sender_name: 'Infernal Judge' },
            },
          ],
        }),
      ],
      '/api/guess': [
        makeResponse({
          result: ['correct', 'present', 'absent', 'absent', 'absent'],
          word: 'cigar',
          clown_triggered: false,
          infernal_penalty_applied: 0,
        }),
        makeResponse({
          result: ['correct', 'absent', 'absent', 'absent', 'absent'],
          word: 'cigar',
          clown_triggered: false,
          infernal_penalty_applied: 5,
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    for (const key of ['C', 'R', 'A', 'N', 'E', 'Enter']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/guess')).toHaveLength(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toHaveTextContent('C');
    });

    for (const key of ['A', 'N', 'Q', 'E', 'Enter']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/guess')).toHaveLength(2);
    });

    expect(await screen.findByText(/you lost/i)).toBeInTheDocument();
    expect(screen.getByText(/use all discovered letters in every guess/i)).toBeInTheDocument();
  });

  test('infernal mandate shows cap warning when rule is broken without additional troop loss', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'infernal_mandate',
              details: { sender_name: 'Infernal Judge' },
            },
          ],
        }),
      ],
      '/api/guess': [
        makeResponse({
          result: ['correct', 'present', 'absent', 'absent', 'absent'],
          word: 'cigar',
          clown_triggered: false,
          infernal_penalty_applied: 0,
        }),
        makeResponse({
          result: ['correct', 'absent', 'absent', 'absent', 'absent'],
          word: 'cigar',
          clown_triggered: false,
          infernal_penalty_applied: 0,
          infernal_rule_broken: true,
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    for (const key of ['C', 'R', 'A', 'N', 'E', 'Enter']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/guess')).toHaveLength(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toHaveTextContent('C');
    });

    for (const key of ['A', 'N', 'Q', 'E', 'Enter']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/guess')).toHaveLength(2);
    });

    expect(await screen.findByText(/no troops were lost because today's infernal penalty cap has already been reached/i)).toBeInTheDocument();
    expect(screen.getByText(/use all discovered letters in every guess/i)).toBeInTheDocument();
  });

  test('shows wandering glyph overlay when sigil illusion is active', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            {
              item_key: 'sigil_of_the_wandering_glyph',
              details: { sender_name: 'Illusionist' },
            },
          ],
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    expect(screen.getByTestId('wandering-glyph')).toBeInTheDocument();
  });

  test('time stop delays reveal progression before advancing row', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/items/active': [
        makeResponse({
          effects: [
            { item_key: 'time_stop', details: { sender_name: 'Chronomancer' } },
          ],
        }),
      ],
      '/api/guess': [
        makeResponse({
          result: ['absent', 'absent', 'absent', 'absent', 'absent'],
          word: 'crane',
          clown_triggered: false,
        }),
      ],
    });

    render(<GameScreen />);
    await waitForInitialLoad();

    jest.useFakeTimers();
    try {
      for (const key of ['C', 'R', 'A', 'N', 'E', 'Enter']) {
        fireEvent.click(screen.getByRole('button', { name: key }));
      }

      await waitFor(() => {
        expect(global.fetch.callsByPath('/api/guess')).toHaveLength(1);
      });

      expect(screen.getByTestId('grid-current-row')).toHaveTextContent('0');

      await act(async () => {
        jest.advanceTimersByTime(1200);
      });

      await waitFor(() => {
        expect(screen.getByTestId('grid-current-row')).toHaveTextContent('1');
      });
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });
});
