import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  </div>
));

jest.mock('../../components/Keyboard', () => function MockKeyboard({ onKeyPress }) {
  const keys = ['C', 'R', 'A', 'N', 'E', 'Q', 'Enter', '⌫'];
  return (
    <div data-testid="keyboard">
      {keys.map((key) => (
        <button key={key} type="button" onClick={() => onKeyPress(key)}>
          {key}
        </button>
      ))}
    </div>
  );
});

jest.mock('../../components/DoubleDownModal', () => () => null);
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
    expect(screen.getByText(/oracle's whisper/i)).toBeInTheDocument();
    expect(screen.getByText(/letter/i)).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('opens inventory modal and filters to self-use items with positive quantity', async () => {
    global.fetch = createFetchMock({
      '/api/campaign/shop/state': [
        makeResponse({
          items: [
            { key: 'oracle_whisper', name: "Oracle's Whisper", requires_target: false, payload_type: 'letter', description: 'Hint' },
            { key: 'voidbrand', name: 'Voidbrand', requires_target: true, description: 'Targeted' },
            { key: 'candle_of_mercy', name: 'Candle of Mercy', requires_target: false, description: 'Mercy' },
          ],
          inventory: [
            { item_key: 'oracle_whisper', quantity: 2 },
            { item_key: 'voidbrand', quantity: 1 },
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
    expect(screen.queryByText(/voidbrand/i)).not.toBeInTheDocument();
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
});
