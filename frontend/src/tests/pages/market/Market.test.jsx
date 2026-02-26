import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Market from '../../../pages/market/Market';

const mockNavigate = jest.fn();

jest.mock('../../../auth/AuthProvider', () => ({
  useAuth: () => ({
    token: 'token',
    user: { user_id: 123 },
    isAuthenticated: true,
    loading: false,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ campaignId: '42' }),
}), { virtual: true });

jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="mock-canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({ size: { width: 1024, height: 768 } }),
}));

jest.mock('@react-three/drei', () => ({
  OrthographicCamera: () => null,
  useCursor: () => {},
  useTexture: () => ({}),
}));

const makeJsonResponse = (json, ok = true) => ({
  ok,
  json: async () => json,
});

const baseState = {
  coins: 10,
  items_by_category: {
    illusion: [
      {
        key: 'cone_of_cold',
        name: 'Cone of Cold',
        category: 'illusion',
        cost: 8,
        description: 'Cold damage.',
        affects_others: true,
      },
      {
        key: 'spider_swarm',
        name: 'Spider Swarm',
        category: 'illusion',
        cost: 5,
        description: 'Spooky spiders.',
        affects_others: true,
      },
    ],
    blessing: [
      {
        key: 'candle_of_mercy',
        name: 'Candle of Mercy',
        category: 'blessing',
        cost: 5,
        description: 'Mercy effect.',
        affects_others: false,
      },
      {
        key: 'cartographers_insight',
        name: "Cartographer's Insight",
        category: 'blessing',
        cost: 5,
        description: 'Map insight.',
        affects_others: false,
      },
    ],
    curse: [
      {
        key: 'voidbrand',
        name: 'Voidbrand',
        category: 'curse',
        cost: 20,
        description: 'Dark curse.',
        affects_others: true,
      },
      {
        key: 'edict_of_compulsion',
        name: 'Edict of Compulsion',
        category: 'curse',
        cost: 15,
        description: 'Forced action.',
        affects_others: true,
      },
    ],
  },
  purchased_item_keys: [],
  can_reshuffle: true,
  can_reshuffle_by_category: { illusion: true, blessing: true, curse: true },
  items: [],
};

function flushFetchQueue(responses) {
  global.fetch = jest.fn(() => {
    if (!responses.length) {
      throw new Error('No mocked fetch responses remaining');
    }
    const next = responses.shift();
    if (typeof next === 'function') return Promise.resolve(next());
    return Promise.resolve(next);
  });
}

function mockFetchOnce({ state = baseState, progress = { name: 'Test Campaign', is_admin_campaign: false } } = {}) {
  global.fetch = jest.fn((url) => {
    if (String(url).includes('/api/campaign/shop/state')) {
      return Promise.resolve(makeJsonResponse(state, true));
    }
    if (String(url).includes('/api/campaign/progress')) {
      return Promise.resolve(makeJsonResponse(progress, true));
    }
    throw new Error(`Unhandled fetch URL: ${url}`);
  });
}

async function renderMarketAndWait() {
  render(<Market />);
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalled();
    expect(screen.getByText(/test campaign market/i)).toBeInTheDocument();
  });
}

describe('Market page', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockFetchOnce();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders map caption and opens a stall from the image map', async () => {
    await renderMarketAndWait();

    expect(screen.getByText(/select a shop on the map to enter its stall/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open blessings shop/i }));

    await waitFor(() => {
      expect(screen.getByText('Blessings')).toBeInTheDocument();
    });

    expect(screen.getByAltText(/blessings stall interior/i)).toBeInTheDocument();
    expect(screen.getByText(/restock/i)).toBeInTheDocument();
  });

  test('overview button returns from stall view to image map overview', async () => {
    await renderMarketAndWait();

    fireEvent.click(screen.getByRole('button', { name: /open curses shop/i }));
    await screen.findByText('Curses');
    expect(screen.getByAltText(/curses stall interior/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /overview/i }));

    await waitFor(() => {
      expect(screen.getByText(/select a shop on the map to enter its stall/i)).toBeInTheDocument();
    });
    expect(screen.queryByAltText(/curses stall interior/i)).not.toBeInTheDocument();
  });

  test('uses mobile hub image map on narrow screens', async () => {
    window.innerWidth = 375;
    await renderMarketAndWait();

    const hubImage = screen.getByAltText(/market hub map with three shop locations/i);
    expect(hubImage.getAttribute('src')).toMatch(/market_hub_map_mobile/i);
  });

  test('renders mobile-targeted subshop picture source and subshop panel state on narrow screens', async () => {
    window.innerWidth = 390;
    await renderMarketAndWait();

    fireEvent.click(screen.getByRole('button', { name: /open blessings shop/i }));
    await screen.findByText('Blessings');

    const subshopImage = screen.getByAltText(/blessings stall interior/i);
    expect(subshopImage).toBeInTheDocument();
    const picture = subshopImage.closest('picture');
    expect(picture).toBeTruthy();
    expect(picture.querySelector('source')?.getAttribute('srcset')).toMatch(/subshop_blessing_mobile/i);
    expect(document.querySelector('.market-surface.is-subshop')).toBeTruthy();
  });

  test('falls back to grouping flat items list when items_by_category is missing', async () => {
    mockFetchOnce({
      state: {
        ...baseState,
        items_by_category: null,
        items: [
          { key: 'candle_of_mercy', name: 'Candle of Mercy', category: 'blessing', cost: 5, description: 'Mercy', affects_others: false },
          { key: 'voidbrand', name: 'Voidbrand', category: 'curse', cost: 20, description: 'Void', affects_others: true },
        ],
      },
    });

    await renderMarketAndWait();
    fireEvent.click(screen.getByRole('button', { name: /open blessings shop/i }));

    await waitFor(() => {
      expect(screen.getByText('Candle of Mercy')).toBeInTheDocument();
    });
  });

  test('shows API error when market state load fails', async () => {
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/api/campaign/shop/state')) {
        return Promise.resolve(makeJsonResponse({ detail: 'Failed to load market' }, false));
      }
      if (String(url).includes('/api/campaign/progress')) {
        return Promise.resolve(makeJsonResponse({ name: 'Test Campaign' }, true));
      }
      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    await renderMarketAndWait();
    fireEvent.click(screen.getByRole('button', { name: /open illusions shop/i }));

    expect(await screen.findByText(/failed to load market/i)).toBeInTheDocument();
  });

  test('opens item modal and disables purchase for already purchased item', async () => {
    mockFetchOnce({
      state: {
        ...baseState,
        purchased_item_keys: ['cone_of_cold'],
      },
    });

    await renderMarketAndWait();
    fireEvent.click(screen.getByRole('button', { name: /open illusions shop/i }));

    await screen.findByText('Cone of Cold');
    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);

    expect(await screen.findByRole('button', { name: 'Purchased' })).toBeDisabled();
  });

  test('purchase success posts to API and refreshes market state', async () => {
    flushFetchQueue([
      // initial load
      () => makeJsonResponse(baseState, true),
      () => makeJsonResponse({ name: 'Test Campaign', is_admin_campaign: false }, true),
      // purchase
      () => makeJsonResponse({ coins: 5 }, true),
      // reload after purchase
      () => makeJsonResponse({ ...baseState, coins: 5 }, true),
      () => makeJsonResponse({ name: 'Test Campaign', is_admin_campaign: false }, true),
    ]);

    await renderMarketAndWait();
    fireEvent.click(screen.getByRole('button', { name: /open blessings shop/i }));
    await screen.findByText('Candle of Mercy');

    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);
    const purchaseBtn = await screen.findByRole('button', { name: 'Purchase' });
    fireEvent.click(purchaseBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaign/shop/purchase'),
        expect.objectContaining({ method: 'POST' })
      );
    });
    await waitFor(() => {
      expect(document.querySelector('.market-coins-value')?.textContent).toContain('5');
    });
  });

  test('purchase API error surfaces message and keeps modal open', async () => {
    flushFetchQueue([
      () => makeJsonResponse({ ...baseState, coins: 99 }, true),
      () => makeJsonResponse({ name: 'Test Campaign', is_admin_campaign: false }, true),
      () => makeJsonResponse({ detail: 'Not enough coins' }, false),
    ]);

    await renderMarketAndWait();
    fireEvent.click(screen.getByRole('button', { name: /open curses shop/i }));
    await screen.findByText('Voidbrand');

    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Purchase' }));

    expect(await screen.findByText(/not enough coins/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Purchase' })).toBeInTheDocument();
  });

  test('reshuffle success posts category and refreshes market state', async () => {
    flushFetchQueue([
      // initial load
      () => makeJsonResponse(baseState, true),
      () => makeJsonResponse({ name: 'Test Campaign', is_admin_campaign: false }, true),
      // reshuffle
      () => makeJsonResponse({
        coins: 7,
        items_by_category: baseState.items_by_category,
      }, true),
      // reload after reshuffle
      () => makeJsonResponse({ ...baseState, coins: 7 }, true),
      () => makeJsonResponse({ name: 'Test Campaign', is_admin_campaign: false }, true),
    ]);

    await renderMarketAndWait();
    fireEvent.click(screen.getByRole('button', { name: /open curses shop/i }));
    await screen.findByText('Voidbrand');

    const reshuffleBtn = screen.getByRole('button', { name: /restock/i });
    fireEvent.click(reshuffleBtn);

    await waitFor(() => {
      const reshuffleCall = global.fetch.mock.calls.find(([url]) =>
        String(url).includes('/api/campaign/shop/reshuffle')
      );
      expect(reshuffleCall).toBeTruthy();
      const body = JSON.parse(reshuffleCall[1].body);
      expect(body).toMatchObject({ campaign_id: 42, category: 'curse' });
    });
  });

  test('reshuffle API error shows message and leaves current stall items visible', async () => {
    flushFetchQueue([
      () => makeJsonResponse(baseState, true),
      () => makeJsonResponse({ name: 'Test Campaign', is_admin_campaign: false }, true),
      () => makeJsonResponse({ detail: 'Restock unavailable today' }, false),
    ]);

    await renderMarketAndWait();
    fireEvent.click(screen.getByRole('button', { name: /open illusions shop/i }));
    await screen.findByText('Cone of Cold');

    fireEvent.click(screen.getByRole('button', { name: /restock/i }));

    expect(await screen.findByText(/restock unavailable today/i)).toBeInTheDocument();
    expect(screen.getByText('Cone of Cold')).toBeInTheDocument();
  });

  test('restock button is disabled when player has fewer than 3 coins', async () => {
    mockFetchOnce({
      state: {
        ...baseState,
        coins: 2,
      },
    });

    await renderMarketAndWait();
    fireEvent.click(screen.getByRole('button', { name: /open blessings shop/i }));
    await screen.findByText('Candle of Mercy');

    expect(screen.getByRole('button', { name: /restock/i })).toBeDisabled();
  });
});
