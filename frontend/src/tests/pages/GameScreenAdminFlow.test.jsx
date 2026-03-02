import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GameScreen from '../../pages/GameScreen';

const mockNavigate = jest.fn();
let mockLocationSearch = '?campaign_id=42';
let mockAuthState = {
  user: { user_id: 42, is_admin: true },
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
    <div data-testid="grid-row-0">{(props.guesses?.[0] || []).join('')}</div>
  </div>
));

jest.mock('../../components/Keyboard', () => function MockKeyboard({ onKeyPress }) {
  const keys = ['A', 'C', 'Enter', '⌫'];
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
jest.mock('../../components/rewards/WeeklyRewardModal', () => () => null);

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
  WanderingGlyphOverlay: () => null,
}));

jest.mock('../../components/items/curses', () => ({
  hasExecutionersCut: () => false,
}));

function makeResponse(json, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => json };
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
        is_admin_campaign: true,
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
    '/api/campaign/items/active': [
      makeResponse({ effects: [] }),
      makeResponse({ effects: [{ item_key: 'vowel_voodoo', details: { sender_name: 'Admin', payload: { value: 'ae' } } }] }),
      makeResponse({ effects: [{ item_key: 'vowel_voodoo', details: { sender_name: 'Admin', payload: { value: 'ae' } } }] }),
    ],
    '/api/campaign/items/status': [
      makeResponse({ effects: [] }),
      makeResponse({ effects: [] }),
      makeResponse({ effects: [{ effect_key: 'twin_fates', payload: { day: 2, letters: [{ letter: 'e', positions: [2, 5] }] } }] }),
    ],
    '/api/campaign/shop/state': [],
    '/api/campaign/items/use': [],
    '/api/admin/effects': [
      makeResponse([
        { key: 'vowel_voodoo', name: 'Vowel Voodoo', category: 'curse', affects_others: true, payload_type: 'vowels' },
        { key: 'consonant_cleaver', name: 'Consonant Cleaver', category: 'curse', affects_others: true, payload_type: 'letters' },
        { key: 'veil_of_obscured_sight', name: 'Veil of Obscured Sight', category: 'curse', affects_others: true, payload_type: 'side' },
        { key: 'twin_fates', name: 'Twin Fates', category: 'blessing', affects_others: false, payload_type: null },
        { key: 'god_of_the_easy_tongue', name: 'God of the Easy Tongue', category: 'blessing', affects_others: false, payload_type: null },
        { key: 'dispel_curse', name: 'Dispel Curse', category: 'blessing', affects_others: false, payload_type: null },
      ]),
    ],
    '/api/admin/effects/add': [
      makeResponse({ status: 'applied' }),
      makeResponse({ status: 'applied' }),
      makeResponse({ status: 'applied' }),
      makeResponse({ status: 'applied' }),
      makeResponse({ status: 'applied' }),
      makeResponse({ status: 'applied' }),
    ],
    '/api/campaign/rewards/pending': [makeResponse({ pending: false })],
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
    '/api/admin/effects',
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
    throw new Error(`Unhandled fetch for ${pathname}`);
  });

  fetchMock.callsByPath = (pathname) => calls.filter((call) => call.pathname === pathname);
  return fetchMock;
}

async function waitForInitialLoad() {
  expect(await screen.findByText(/day 2 of 7/i)).toBeInTheDocument();
}

function getAdminAddBodies(fetchMock) {
  return fetchMock
    .callsByPath('/api/admin/effects/add')
    .map((entry) => JSON.parse(String(entry.options?.body || '{}')));
}

async function selectAndApplyEffect(effectSelect, effectKey, fillPayload) {
  fireEvent.change(effectSelect, { target: { value: effectKey } });
  await waitFor(() => expect(effectSelect.value).toBe(effectKey));
  if (fillPayload) {
    await fillPayload();
  }
  fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
}

describe('GameScreen admin effect flow', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockAuthState = {
      user: { user_id: 42, is_admin: true },
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

  test('admin can apply new effect payloads and game reflects updates', async () => {
    render(<GameScreen />);
    await waitForInitialLoad();

    fireEvent.click(screen.getByRole('button', { name: /admin/i }));
    expect(await screen.findByText(/admin tools/i)).toBeInTheDocument();

    const effectSelect = screen.getByLabelText(/add effect/i);

    await selectAndApplyEffect(effectSelect, 'vowel_voodoo', async () => {
      await waitFor(() => expect(screen.getByPlaceholderText('ae')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('ae'), { target: { value: 'ae' } });
    });

    await selectAndApplyEffect(effectSelect, 'consonant_cleaver', async () => {
      await waitFor(() => expect(screen.getByPlaceholderText(/bcdf/i)).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/bcdf/i), { target: { value: 'bcdf' } });
    });

    await selectAndApplyEffect(effectSelect, 'veil_of_obscured_sight', async () => {
      await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(1));
      fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'left' } });
    });

    await selectAndApplyEffect(effectSelect, 'twin_fates');
    await selectAndApplyEffect(effectSelect, 'god_of_the_easy_tongue');
    await selectAndApplyEffect(effectSelect, 'dispel_curse');

    await waitFor(() => {
      expect(global.fetch.callsByPath('/api/admin/effects/add').length).toBe(6);
    });

    const bodies = getAdminAddBodies(global.fetch);
    expect(bodies[0]).toMatchObject({ effect_key: 'vowel_voodoo', effect_payload: { value: 'ae' } });
    expect(bodies[1]).toMatchObject({ effect_key: 'consonant_cleaver', effect_payload: { value: 'bcdf' } });
    expect(bodies[2]).toMatchObject({ effect_key: 'veil_of_obscured_sight', effect_payload: { value: 'left' } });
    expect(bodies[3]).toMatchObject({ effect_key: 'twin_fates' });
    expect(bodies[4]).toMatchObject({ effect_key: 'god_of_the_easy_tongue' });
    expect(bodies[5]).toMatchObject({ effect_key: 'dispel_curse' });

    // After admin refresh, vowel voodoo should block A on early rows.
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-0')).toHaveTextContent('');
    });

    // Twin Fates status banner appears after status refresh.
    expect(await screen.findByText(/twin fates:/i)).toBeInTheDocument();
    expect(screen.getByText(/E at 2, 5/i)).toBeInTheDocument();
  });
});
