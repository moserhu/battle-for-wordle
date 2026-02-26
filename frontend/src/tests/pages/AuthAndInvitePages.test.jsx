import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login from '../../pages/Login';
import Register from '../../pages/Register';
import Invite from '../../pages/Invite';
import MainLandingPage from '../../pages/MainLandingPage';

const mockNavigate = jest.fn();
const mockAuthLogin = jest.fn();
let mockAuthState = {
  user: { user_id: 1, is_admin: false },
  token: 'token',
  isAuthenticated: true,
  loading: false,
  login: mockAuthLogin,
};
let mockLocationSearch = '';
let mockSearchParams = new URLSearchParams();

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => <span data-testid="fa-icon" />,
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: mockLocationSearch }),
  useSearchParams: () => [mockSearchParams],
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });

function makeResponse(json, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => json };
}

describe('Auth, invite, and landing pages', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockAuthLogin.mockReset();
    mockAuthState = {
      user: { user_id: 1, first_name: 'Test' },
      token: 'token',
      isAuthenticated: true,
      loading: false,
      login: mockAuthLogin,
    };
    mockLocationSearch = '';
    mockSearchParams = new URLSearchParams();
    global.fetch = jest.fn();
    window.alert = jest.fn();
    window.localStorage.setItem = jest.fn();
    window.localStorage.getItem = jest.fn(() => 'Bearer token');
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('MainLandingPage navigates to login from CTA', () => {
    render(<MainLandingPage />);

    fireEvent.click(screen.getByRole('button', { name: /join the fight/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('Login submits credentials, calls auth login, and respects redirectTo', async () => {
    mockLocationSearch = '?redirectTo=%2Fcampaigns';
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse({
        access_token: 'abc',
        user: { user_id: 5, first_name: 'Ada' },
      })
    );

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'a@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => {
      expect(mockAuthLogin).toHaveBeenCalledWith({ user_id: 5, first_name: 'Ada' }, 'abc');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/campaigns');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/login'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('Login shows server error and toggles password visibility', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse({ detail: 'Bad credentials' }, { ok: false, status: 401 })
    );

    render(<Login />);

    const passwordInput = screen.getByPlaceholderText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(document.querySelector('.toggle-password'));
    expect(screen.getByPlaceholderText(/password/i)).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    expect(await screen.findByText(/bad credentials/i)).toBeInTheDocument();
  });

  test('Register formats phone input and redirects to login on success', async () => {
    mockLocationSearch = '?redirectTo=%2Finvite%3Fcampaign_id%3D2';
    global.fetch = jest.fn().mockResolvedValue(makeResponse({ user_id: 7 }));

    render(<Register />);

    fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { name: 'first_name', value: 'Jane' } });
    fireEvent.change(screen.getByPlaceholderText(/last name/i), { target: { name: 'last_name', value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/\(###\) ###-####/i), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { name: 'email', value: 'jane@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { name: 'password', value: 'pw' } });

    expect(screen.getByPlaceholderText(/\(###\) ###-####/i)).toHaveValue('(555) 123-4567');

    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText(/registered! redirecting to login/i)).toBeInTheDocument();
    jest.advanceTimersByTime(1500);
    expect(mockNavigate).toHaveBeenCalledWith('/login?redirectTo=%2Finvite%3Fcampaign_id%3D2');
  });

  test('Register shows API error on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse({ detail: 'Email already exists' }, { ok: false, status: 400 })
    );

    render(<Register />);
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText(/email already exists/i)).toBeInTheDocument();
  });

  test('Invite redirects unauthenticated users to login with encoded redirect', async () => {
    mockSearchParams = new URLSearchParams({ campaign_id: '9', campaign_name: 'Guild Name' });
    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: false,
      loading: false,
    };

    render(<Invite />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?redirectTo=%2Finvite%3Fcampaign_id%3D9%26campaign_name%3DGuild%2520Name'
      );
    });
  });

  test('Invite joins campaign, stores invite metadata, and navigates to game', async () => {
    mockSearchParams = new URLSearchParams({ campaign_id: '11', campaign_name: 'Test%20Realm' });
    mockAuthState = { ...mockAuthState, isAuthenticated: true };
    global.fetch = jest.fn().mockResolvedValue(makeResponse({ invite_code: 'ABCD' }));

    render(<Invite />);

    fireEvent.click(screen.getByRole('button', { name: /join campaign/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaign/join_by_id'),
        expect.objectContaining({ method: 'POST' })
      );
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game');
    });
  });

  test('Invite shows expiry-specific error for 410 response', async () => {
    mockSearchParams = new URLSearchParams({ campaign_id: '11', campaign_name: 'Test%20Realm' });
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse({ detail: 'Expired' }, { ok: false, status: 410 })
    );

    render(<Invite />);
    fireEvent.click(screen.getByRole('button', { name: /join campaign/i }));

    expect(await screen.findByText(/invite has expired/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/game');
  });

  test('Invite shows invalid link message when params are missing', () => {
    mockSearchParams = new URLSearchParams();
    render(<Invite />);

    expect(screen.getByText(/invalid or missing invite link/i)).toBeInTheDocument();
  });
});
