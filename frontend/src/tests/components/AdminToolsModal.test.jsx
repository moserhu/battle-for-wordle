import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminToolsModal from '../../components/admin/AdminToolsModal';

jest.mock('../../components/rewards/WeeklyRewardModal', () => () => null);

function makeResponse(json, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => json };
}

function createFetchRouter(routes, repeatable = []) {
  const cache = {};
  return jest.fn(async (url, options = {}) => {
    const pathname = new URL(String(url), window.location.origin).pathname;
    const method = String(options.method || 'GET').toUpperCase();
    const key = `${method} ${pathname}`;
    const queue = routes[key];
    if (queue && queue.length > 0) {
      const next = queue.shift();
      cache[key] = next;
      return next;
    }
    if (repeatable.includes(key) && cache[key]) return cache[key];
    throw new Error(`Unhandled fetch ${key}`);
  });
}

function getAddEffectCallBody(fetchMock) {
  const call = fetchMock.mock.calls.find(([url]) =>
    String(url).includes('/api/admin/effects/add')
  );
  if (!call) return null;
  return JSON.parse(call[1].body);
}

describe('AdminToolsModal', () => {
  test('groups effects by curses, illusions, and blessings in the selector', async () => {
    global.fetch = createFetchRouter({
      'GET /api/admin/effects': [
        makeResponse([
          { key: 'vowel_voodoo', name: 'Vowel Voodoo', category: 'curse', affects_others: true, payload_type: 'vowels' },
          { key: 'wandering_glyph', name: 'Wandering Glyph', category: 'illusion', affects_others: false, payload_type: null },
          { key: 'twin_fates', name: 'Twin Fates', category: 'blessing', affects_others: false, payload_type: null },
        ]),
      ],
    }, ['GET /api/admin/effects']);

    render(
      <AdminToolsModal
        isOpen
        onClose={() => {}}
        campaignId={7}
        token="token"
        isAdmin
        isAdminCampaign
        onSuccess={() => {}}
      />
    );

    await screen.findByText(/admin tools/i);
    await waitFor(() => expect(screen.getByLabelText(/add effect/i)).toBeInTheDocument());

    const select = screen.getByLabelText(/add effect/i);
    const groups = Array.from(select.querySelectorAll('optgroup')).map((node) => node.getAttribute('label'));
    expect(groups).toEqual(['Curses', 'Illusions', 'Blessings']);
  });

  test('submits selected vowel payload for vowel voodoo', async () => {
    global.fetch = createFetchRouter({
      'GET /api/admin/effects': [
        makeResponse([
          { key: 'vowel_voodoo', name: 'Vowel Voodoo', category: 'curse', affects_others: true, payload_type: 'vowels' },
        ]),
      ],
      'POST /api/admin/effects/add': [makeResponse({ status: 'applied' })],
    }, ['GET /api/admin/effects']);

    render(
      <AdminToolsModal
        isOpen
        onClose={() => {}}
        campaignId={7}
        token="token"
        isAdmin
        isAdminCampaign
        onSuccess={() => {}}
      />
    );

    await screen.findByText(/admin tools/i);
    await waitFor(() => expect(screen.getByPlaceholderText('ae')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('ae'), { target: { value: 'ae' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => {
      const body = getAddEffectCallBody(global.fetch);
      expect(body.effect_key).toBe('vowel_voodoo');
      expect(body.effect_payload).toEqual({ value: 'ae' });
    });
  });

  test('blocks invalid consonant cleaver payload and accepts valid one', async () => {
    global.fetch = createFetchRouter({
      'GET /api/admin/effects': [
        makeResponse([
          { key: 'consonant_cleaver', name: 'Consonant Cleaver', category: 'curse', affects_others: true, payload_type: 'letters' },
        ]),
      ],
      'POST /api/admin/effects/add': [makeResponse({ status: 'applied' })],
    }, ['GET /api/admin/effects']);

    render(
      <AdminToolsModal
        isOpen
        onClose={() => {}}
        campaignId={7}
        token="token"
        isAdmin
        isAdminCampaign
        onSuccess={() => {}}
      />
    );

    await screen.findByText(/admin tools/i);
    await waitFor(() => expect(screen.getByPlaceholderText(/bcdf/i)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/bcdf/i), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.getByText(/four unique consonants/i)).toBeInTheDocument();
    expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/api/admin/effects/add'))).toBe(false);

    fireEvent.change(screen.getByPlaceholderText(/bcdf/i), { target: { value: 'bcdf' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => {
      const body = getAddEffectCallBody(global.fetch);
      expect(body.effect_payload).toEqual({ value: 'bcdf' });
    });
  });

  test('supports side selection payload for veil of obscured sight', async () => {
    global.fetch = createFetchRouter({
      'GET /api/admin/effects': [
        makeResponse([
          { key: 'blinding_brew', name: 'Veil of Obscured Sight', category: 'curse', affects_others: true, payload_type: 'side' },
        ]),
      ],
      'POST /api/admin/effects/add': [makeResponse({ status: 'applied' })],
    }, ['GET /api/admin/effects']);

    render(
      <AdminToolsModal
        isOpen
        onClose={() => {}}
        campaignId={7}
        token="token"
        isAdmin
        isAdminCampaign
        onSuccess={() => {}}
      />
    );

    await screen.findByText(/admin tools/i);
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(1));
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'left' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => {
      const body = getAddEffectCallBody(global.fetch);
      expect(body.effect_payload).toEqual({ value: 'left' });
    });
  });

  test('submits add troops action with amount payload', async () => {
    const onSuccess = jest.fn();
    global.fetch = createFetchRouter({
      'GET /api/admin/effects': [makeResponse([])],
      'POST /api/admin/add_troops': [makeResponse({ score: 125 })],
    }, ['GET /api/admin/effects']);

    render(
      <AdminToolsModal
        isOpen
        onClose={() => {}}
        campaignId={7}
        token="token"
        isAdmin
        isAdminCampaign
        onSuccess={onSuccess}
      />
    );

    await screen.findByText(/admin tools/i);
    fireEvent.change(screen.getByLabelText(/adjust troops/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /add troops/i }));

    await waitFor(() => {
      const call = global.fetch.mock.calls.find(([url]) =>
        String(url).includes('/api/admin/add_troops')
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(call[1].body)).toEqual({ campaign_id: 7, amount: 25 });
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
