import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Home from '../../pages/Home';
import UpdateLogs from '../../pages/UpdateLogs';
import AccountScreen from '../../pages/AccountScreen';
import Leaderboard from '../../pages/Leaderboard';

const mockNavigate = jest.fn();
let mockAuthState = {
  user: { user_id: 1, first_name: 'Hunter', is_admin: false },
  token: 'token',
  isAuthenticated: true,
  loading: false,
};
let mockParams = {};

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../../components/GlobalLeaderboard', () => () => <div data-testid="global-leaderboard">Global LB</div>);
jest.mock('../../components/uploads/ImageUploadField', () => () => <div data-testid="image-upload-field">Upload</div>);

jest.mock('chart.js', () => ({
  Chart: { register: jest.fn() },
  ArcElement: {},
  Tooltip: {},
  Legend: {},
}));
jest.mock('react-chartjs-2', () => ({
  Pie: () => <div data-testid="pie-chart">Pie</div>,
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}), { virtual: true });

function makeResponse(json, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => json };
}

function createFetchRouter(routes) {
  const calls = [];
  const fn = jest.fn(async (url) => {
    const pathname = new URL(String(url), window.location.origin).pathname;
    calls.push(pathname);
    const queue = routes[pathname];
    if (!queue || queue.length === 0) throw new Error(`Unhandled fetch ${pathname}`);
    return queue.shift();
  });
  fn.calls = calls;
  return fn;
}

describe('Core pages', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockParams = {};
    mockAuthState = {
      user: { user_id: 1, first_name: 'Hunter', is_admin: false },
      token: 'token',
      isAuthenticated: true,
      loading: false,
    };
    global.fetch = jest.fn();
    window.alert = jest.fn();
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Home redirects unauthenticated user and renders campaigns/actions on success', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(makeResponse([
      { campaign_id: 7, name: 'Realm A', daily_completed: true, is_admin_campaign: false },
    ]));

    render(<Home />);

    expect(await screen.findByText(/your campaigns/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/play realm a/i)).toBeInTheDocument();
    expect(screen.getByTestId('global-leaderboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /manage/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/campaigns');
  });

  test('Home falls back to empty campaigns state on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom'));

    render(<Home />);

    expect(await screen.findByText(/no campaigns yet/i)).toBeInTheDocument();
  });

  test('UpdateLogs renders non-admin list and admin can add/edit/delete entries', async () => {
    mockAuthState = { ...mockAuthState, user: { ...mockAuthState.user, is_admin: true } };
    global.fetch = createFetchRouter({
      '/api/updates': [
        makeResponse([{ id: 1, date: '2026-02-20', title: 'Patch', items: ['Fix A'] }]), // initial load
        makeResponse([{ id: 1, date: '2026-02-21', title: 'Patch 2', items: ['Fix B'] }]), // after save
        makeResponse([]), // after delete
      ],
      '/api/updates/1': [
        makeResponse({ id: 1 }), // put
        makeResponse({ ok: true }), // delete
      ],
    });

    render(<UpdateLogs />);
    expect(await screen.findByText(/patch/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit update/i }));
    fireEvent.change(screen.getByLabelText(/^date$/i, { selector: 'input' }), { target: { value: '2026-02-21' } });
    fireEvent.change(screen.getByLabelText(/^title$/i, { selector: 'input' }), { target: { value: 'Patch 2' } });
    fireEvent.change(screen.getAllByDisplayValue(/fix a/i)[0], { target: { value: 'Fix B' } });
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));

    await waitFor(() => expect(screen.getByText(/patch 2/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.change(screen.getByPlaceholderText(/^yes$/i), { target: { value: 'yes' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i }).slice(-1)[0]);

    await waitFor(() => expect(screen.getByText(/no updates yet/i)).toBeInTheDocument());
  });

  test('UpdateLogs shows load error message when API fails', async () => {
    global.fetch = createFetchRouter({
      '/api/updates': [makeResponse({ detail: 'Nope' }, { ok: false, status: 500 })],
    });

    render(<UpdateLogs />);

    expect(await screen.findByText(/nope/i)).toBeInTheDocument();
  });

  test('AccountScreen loads user info, enters edit mode, and saves changes', async () => {
    global.fetch = createFetchRouter({
      '/api/user/info': [
        makeResponse({
          email: 'a@test.com',
          first_name: 'Alpha',
          last_name: 'Beta',
          phone: '5551234567',
          campaigns: 2,
          total_guesses: 10,
          correct_guesses: 7,
          campaign_wins: 1,
          campaign_losses: 1,
          profile_image_url: '',
          profile_image_thumb_url: '',
        }),
      ],
      '/api/user/update': [
        makeResponse({ ok: true }),
      ],
    });

    render(<AccountScreen />);

    expect(await screen.findByText(/my account/i)).toBeInTheDocument();
    expect(await screen.findByText(/a@test\.com/i)).toBeInTheDocument();
    const phoneLine = screen.getByText(/phone:/i).closest('p');
    expect(phoneLine).toHaveTextContent('(555) 123-4567');
    expect(screen.getByTestId('image-upload-field')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /make changes/i }));
    fireEvent.change(document.querySelector('input[name="first_name"]'), { target: { name: 'first_name', value: 'Gamma' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/update'),
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(document.querySelector('input[name="first_name"]')).toHaveValue('Gamma');
  });

  test('Leaderboard shows rankings screen and preview modal interactions', async () => {
    mockParams = { id: '7' };
    global.fetch = createFetchRouter({
      '/api/campaign/finished_today': [makeResponse({ ended: false })],
      '/api/campaign/progress': [makeResponse({ day: 1, total: 7, is_admin_campaign: false })],
      '/api/leaderboard': [makeResponse([
        { username: 'Alice', score: 12, played_today: true, color: '#f00', profile_image_url: '' },
      ])],
    });

    render(<Leaderboard />);

    expect(await screen.findByText(/leaderboard/i)).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByText(/alice/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);

    fireEvent.click(screen.getByText(/alice/i));
    expect(screen.getByText(/unnamed army/i)).toBeInTheDocument();
  });

  test('Leaderboard declares winner when campaign is ended', async () => {
    mockParams = { id: '8' };
    global.fetch = createFetchRouter({
      '/api/campaign/finished_today': [makeResponse({ ended: true })],
      '/api/campaign/progress': [makeResponse({ day: 7, total: 7, is_admin_campaign: false })],
      '/api/leaderboard': [makeResponse([
        { username: 'Bob', score: 20, played_today: true },
        { username: 'Carl', score: 10, played_today: true },
      ])],
    });

    render(<Leaderboard />);

    expect(await screen.findByText(/declared ruler/i)).toBeInTheDocument();
    expect(screen.getByText(/bob/i)).toBeInTheDocument();
  });
});
