import { describe, expect, it, vi } from 'vitest';
import { AuthorizedTrackingApi } from './authorized-tracking';
import type { ConsentPermit } from '../gdpr/consent-client';

const expires = '2099-01-01T00:00:00Z';
const permit: ConsentPermit = { credential: 'a'.repeat(64) + '.' + 'b'.repeat(64),
  version: '1'.repeat(32), expiresAt: Date.parse(expires) };
const tracker = { subject: 'tracker-' + 'a'.repeat(32), revision: 2, provider: 'google-analytics', identifier: 'G-ABC123' };
const data = { version: permit.version, expires_at: expires, trackers: [tracker] };
function reply(value: unknown): Response { return new Response(JSON.stringify({ data: value })); }

describe('authorized tracking client', () => {
  it('never calls the API without a current permit', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => reply(data));
    const api = new AuthorizedTrackingApi('front', 'https://api.example.test', fetcher);
    expect(await api.authorized(null)).toEqual([]);
    expect(await api.authorized({ ...permit, expiresAt: 1 })).toEqual([]);
    expect(await api.authorized({ ...permit, credential: 'invalid' })).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses only the dedicated API and consent credential', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => reply(data));
    const api = new AuthorizedTrackingApi('app', 'https://api.example.test', fetcher);
    expect(await api.authorized(permit)).toEqual([tracker]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.example.test/apiopen/tracking/app/authorized');
    expect(init?.credentials).toBe('omit');
    expect(init?.redirect).toBe('error');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer ' + permit.credential);
    expect(JSON.parse(String(init?.body))).toEqual({ version: permit.version });
  });
  it('rejects stale versions, unknown providers, malformed identifiers and duplicate configurations', async () => {
    for (const bad of [
      { ...data, version: '2'.repeat(32) },
      { ...data, expires_at: '2098-01-01T00:00:00Z' },
      { ...data, trackers: [{ ...tracker, provider: 'google-tag-manager' }] },
      { ...data, trackers: [{ ...tracker, identifier: '<script>' }] },
      { ...data, trackers: [tracker, tracker] },
      { ...data, trackers: [tracker, { ...tracker, subject: 'tracker-' + 'b'.repeat(32) }] },
    ]) {
      const api = new AuthorizedTrackingApi('front', 'https://api.example.test', async () => reply(bad));
      await expect(api.authorized(permit)).rejects.toThrow();
    }
  });
  it('discards a response if consent is withdrawn while fetching', async () => {
    const controller = new AbortController();
    const api = new AuthorizedTrackingApi('front', 'https://api.example.test', async () => {
      controller.abort();
      return reply(data);
    });
    expect(await api.authorized(permit, controller.signal)).toEqual([]);
  });
  it('rejects HTTP failure rather than reuse cached authorization', async () => {
    const api = new AuthorizedTrackingApi('front', 'https://api.example.test', async () => new Response('{}', {status: 409}));
    await expect(api.authorized(permit)).rejects.toThrow();
  });
});
