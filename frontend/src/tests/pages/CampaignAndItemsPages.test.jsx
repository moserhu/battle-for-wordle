import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Campaigns from '../../pages/Campaigns';
import CampaignDashboard from '../../pages/CampaignDashboard';
import ItemsStorage from '../../pages/ItemsStorage';

const mockNavigate = jest.fn();
let mockAuthState = {
  user: { user_id: 1, first_name: 'Test', is_admin: true },
  token: 'token',
  isAuthenticated: true,
  loading: false,
};
let mockParams = {};

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => <span data-testid="fa-icon" />,
}));

jest.mock('../../components/ShareCard', () => (props) => (
  <div data-testid="share-card">Share {props.campaignName} {props.inviteCode}</div>
));
jest.mock('../../components/HubBar', () => (props) => (
  <div data-testid="hub-bar">
    <button type="button" onClick={props.onBattle}>Battle</button>
    <button type="button" onClick={props.onInventory}>Inventory</button>
    <button type="button" onClick={props.onShop}>Shop</button>
    <button type="button" onClick={props.onStreakInfo}>StreakInfo</button>
    <span>{props.coins}</span>
  </div>
));
jest.mock('../../components/RulerTitleModal', () => (props) => (
  props.visible ? <button type="button" onClick={() => props.onSave('New Title')}>Save Ruler</button> : null
));
jest.mock('../../components/ProfileModal', () => () => null);
jest.mock('../../components/StreakInfoModal', () => () => null);
jest.mock('../../components/AccoladesModal', () => () => null);

const blessingItems = {
  oracleWhisper: { key: 'oracle_whisper', name: "Oracle's Whisper", description: 'hint', requires_target: false, payload_type: 'letter' },
  cartographersInsight: { key: 'cartographers_insight', name: "Cartographer's Insight", description: 'map', requires_target: false },
  candleOfMercy: { key: 'candle_of_mercy', name: 'Candle of Mercy', description: 'mercy', requires_target: false },
};
const illusionItems = {
  bloodOathInk: { key: 'blood_oath_ink', name: 'Blood Oath Ink', description: 'ink', requires_target: false },
  spiderSwarm: { key: 'spider_swarm', name: 'Spider Swarm', description: 'spiders', requires_target: true },
  sendInTheClown: { key: 'send_in_the_clown', name: 'Send in the Clown', description: 'clown', requires_target: true },
  danceOfTheJester: { key: 'dance_of_the_jester', name: 'Dance of the Jester', description: 'dance', requires_target: true },
  coneOfCold: { key: 'cone_of_cold', name: 'Cone of Cold', description: 'cold', requires_target: true },
};
const curseItems = {
  sealOfSilence: { key: 'seal_of_silence', name: 'Seal of Silence', description: 'seal', requires_target: true, payload_type: 'letter' },
  voidbrand: { key: 'voidbrand', name: 'Voidbrand', description: 'void', requires_target: true, payload_type: 'word' },
  executionersCut: { key: 'executioners_cut', name: "Executioner's Cut", description: 'cut', requires_target: true },
  edictOfCompulsion: { key: 'edict_of_compulsion', name: 'Edict of Compulsion', description: 'edict', requires_target: true, payload_type: 'word' },
};

jest.mock('../../components/items/blessings', () => blessingItems);
jest.mock('../../components/items/illusions', () => illusionItems);
jest.mock('../../components/items/curses', () => curseItems);

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}), { virtual: true });

function makeResponse(json, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => json };
}

function createFetchRouter(routes, repeatable = []) {
  const cache = {};
  const fn = jest.fn(async (url) => {
    const pathname = new URL(String(url), window.location.origin).pathname;
    const queue = routes[pathname];
    if (queue && queue.length) {
      const next = queue.shift();
      cache[pathname] = next;
      return next;
    }
    if (repeatable.includes(pathname) && cache[pathname]) return cache[pathname];
    throw new Error(`Unhandled fetch ${pathname}`);
  });
  return fn;
}

describe('Campaigns, Dashboard, and Items pages', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockParams = {};
    mockAuthState = {
      user: { user_id: 1, first_name: 'Test', is_admin: true },
      token: 'token',
      isAuthenticated: true,
      loading: false,
    };
    global.fetch = jest.fn();
    window.alert = jest.fn();
    localStorage.setItem = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Campaigns loads list, can join campaign via modal, and create campaign', async () => {
    global.fetch = createFetchRouter({
      '/api/user/campaigns': [
        makeResponse([{ campaign_id: 1, name: 'Realm One', daily_completed: false, is_admin_campaign: false }]),
      ],
      '/api/campaigns/owned': [
        makeResponse([{ id: 1, name: 'Realm One' }]),
      ],
      '/api/campaign/join': [
        makeResponse({ campaign_id: 22 }),
      ],
      '/api/campaign/create': [
        makeResponse({ campaign_id: 33 }),
      ],
    });

    render(<Campaigns />);
    expect(await screen.findByText(/realm one/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /join campaign/i }));
    fireEvent.change(screen.getByPlaceholderText(/enter invite code/i), { target: { value: 'ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/game?campaign_id=22'));

    fireEvent.click(screen.getByRole('button', { name: /create campaign/i }));
    fireEvent.change(screen.getByLabelText(/campaign name/i), { target: { value: 'New Realm' } });
    fireEvent.click(screen.getByRole('button', { name: /^7$/i }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/game?campaign_id=33'));
  });

  test('Campaigns manage modal supports loading members and rename refresh', async () => {
    global.fetch = createFetchRouter({
      '/api/user/campaigns': [
        makeResponse([{ campaign_id: 1, name: 'Realm One', daily_completed: false }]),
        makeResponse([{ campaign_id: 1, name: 'Realm Renamed', daily_completed: false }]),
      ],
      '/api/campaigns/owned': [
        makeResponse([{ id: 1 }]),
      ],
      '/api/campaign/members': [
        makeResponse([{ user_id: 2, name: 'Knight' }]),
      ],
      '/api/campaign/update_name': [
        makeResponse({ ok: true }),
      ],
    }, ['/api/campaigns/owned']);

    render(<Campaigns />);
    expect(await screen.findByText(/realm one/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/manage realm one/i));
    expect(await screen.findByText(/manage campaign/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /load members/i }));
    expect(await screen.findByText(/knight/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/campaign name/i), { target: { value: 'Realm Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    await waitFor(() => expect(screen.queryByText(/manage campaign/i)).not.toBeInTheDocument());
  });

  test('Campaigns blocks create and rename when campaign name exceeds 32 chars', async () => {
    const tooLongName = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567';
    expect(tooLongName.length).toBeGreaterThan(32);

    global.fetch = createFetchRouter({
      '/api/user/campaigns': [
        makeResponse([{ campaign_id: 1, name: 'Realm One', daily_completed: false }]),
      ],
      '/api/campaigns/owned': [
        makeResponse([{ id: 1 }]),
      ],
    }, ['/api/campaigns/owned']);

    render(<Campaigns />);
    expect(await screen.findByText(/realm one/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create campaign/i }));
    fireEvent.change(screen.getByLabelText(/campaign name/i), { target: { value: tooLongName } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(window.alert).toHaveBeenCalledWith('Campaign name must be 32 characters or fewer.');
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/campaign/create'),
      expect.anything()
    );
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    fireEvent.click(screen.getByLabelText(/manage realm one/i));
    expect(await screen.findByText(/manage campaign/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/campaign name/i, { selector: '#renameCampaign' }), { target: { value: tooLongName } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));
    expect(window.alert).toHaveBeenCalledWith('Campaign name must be 32 characters or fewer.');
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/campaign/update_name'),
      expect.anything()
    );
  });

  test('CampaignDashboard loads hub data, recap, leaderboard, and routes actions', async () => {
    mockParams = { id: '44' };
    global.fetch = createFetchRouter({
      '/api/campaign/progress': [makeResponse({
        campaign_id: 44, name: 'Forty Four', day: 2, total: 7, king: 'King', ruler_id: 1, ruler_title: 'Old Title'
      })],
      '/api/campaign/self_member': [makeResponse({
        display_name: 'Hero', double_down_activated: 0, double_down_used_week: 0, daily_completed: 0
      })],
      '/api/campaign/accolades': [makeResponse({ accolades: [] })],
      '/api/campaign/streak': [makeResponse({ streak: 4 })],
      '/api/campaign/coins': [makeResponse({ coins: 99 })],
      '/api/leaderboard': [makeResponse([{ user_id: 1, username: 'Hero', display_name: 'Hero', score: 10 }])],
      '/api/campaign/44/recap': [makeResponse({
        date: '2026-02-25',
        date_label: 'Feb 25',
        summary: 'A battle happened.',
        events: [{ name: 'Hero', text: 'Won', profile_image_url: '' }],
      })],
      '/api/campaign/ruler_title': [makeResponse({ ruler_title: 'New Title' })],
    }, ['/api/campaign/44/recap']);

    render(<CampaignDashboard />);

    expect(await screen.findByText(/forty four/i)).toBeInTheDocument();
    expect(screen.getByTestId('hub-bar')).toBeInTheDocument();
    expect(screen.getByText(/battle log/i)).toBeInTheDocument();
    expect(await screen.findByText(/a battle happened/i)).toBeInTheDocument();
    expect(screen.getAllByText(/hero/i).length).toBeGreaterThan(0);

    const hubBar = screen.getByTestId('hub-bar');
    fireEvent.click(within(hubBar).getByRole('button', { name: /^battle$/i }));
    fireEvent.click(within(hubBar).getByRole('button', { name: /^inventory$/i }));
    fireEvent.click(within(hubBar).getByRole('button', { name: /^shop$/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/game?campaign_id=44');
    expect(mockNavigate).toHaveBeenCalledWith('/campaign/44/items');
    expect(mockNavigate).toHaveBeenCalledWith('/campaign/44/market');

    fireEvent.click(screen.getByRole('button', { name: '📜' }));
    fireEvent.click(screen.getByRole('button', { name: /save ruler/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaign/ruler_title'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('ItemsStorage loads inventory, validates target/payload, and uses item', async () => {
    mockParams = { campaignId: '5' };
    global.fetch = createFetchRouter({
      '/api/campaign/shop/state': [
        makeResponse({
          items: [curseItems.sealOfSilence],
          inventory: [{ item_key: 'seal_of_silence', quantity: 1 }],
        }),
        makeResponse({
          items: [curseItems.sealOfSilence],
          inventory: [],
        }),
      ],
      '/api/campaign/progress': [makeResponse({ is_admin_campaign: false })],
      '/api/campaign/targets/item': [
        makeResponse([{ user_id: 2, display_name: 'Enemy', blocked: false }]),
      ],
      '/api/campaign/items/use': [
        makeResponse({ ok: true }),
      ],
    }, ['/api/campaign/progress']);

    render(<ItemsStorage />);
    expect(await screen.findByText(/my items/i)).toBeInTheDocument();
    expect(await screen.findByText(/seal of silence/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^use$/i }));
    expect(await screen.findByText(/select a target to use this item/i)).toBeInTheDocument();

    const modalUse = screen.getAllByRole('button', { name: /^use$/i }).slice(-1)[0];
    expect(modalUse).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/choose a letter/i), { target: { value: 'ab' } });
    expect(screen.getByLabelText(/choose a letter/i)).toHaveValue('a');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    fireEvent.click(modalUse);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaign/items/use'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => expect(screen.getByText(/no items stored yet/i)).toBeInTheDocument());
  });

  test('ItemsStorage normalizes invalid-word API errors in target modal', async () => {
    mockParams = { campaignId: '6' };
    global.fetch = createFetchRouter({
      '/api/campaign/shop/state': [
        makeResponse({
          items: [curseItems.voidbrand],
          inventory: [{ item_key: 'voidbrand', quantity: 1 }],
        }),
      ],
      '/api/campaign/progress': [makeResponse({ is_admin_campaign: false })],
      '/api/campaign/targets/item': [
        makeResponse([{ user_id: 2, display_name: 'Enemy', blocked: false }]),
      ],
      '/api/campaign/items/use': [
        makeResponse({ detail: 'Invalid word for playable word list' }, { ok: false, status: 400 }),
      ],
    }, ['/api/campaign/progress']);

    render(<ItemsStorage />);
    await screen.findByText(/voidbrand/i);

    fireEvent.click(screen.getByRole('button', { name: /^use$/i }));
    await screen.findByText(/select a target to use this item/i);
    fireEvent.change(screen.getByLabelText(/choose a word/i), { target: { value: 'abcde' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^use$/i }).slice(-1)[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/word must be a valid guess/i);
  });
});
