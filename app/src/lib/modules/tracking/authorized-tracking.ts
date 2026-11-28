import { isCredential, type ConsentPermit, type Scope } from '../gdpr/consent-client';

export type AuthorizedTracker = {
  subject: string;
  revision: number;
  provider: 'google-analytics' | 'meta-pixel';
  identifier: string;
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tracker(value: unknown): value is AuthorizedTracker {
  if (!object(value) || typeof value.subject !== 'string' || !/^tracker-[a-f0-9]{32}$/.test(value.subject)
    || typeof value.revision !== 'number' || !Number.isInteger(value.revision)
    || value.revision < 1 || value.revision > 2147483647 || typeof value.identifier !== 'string') return false;
  return (value.provider === 'google-analytics' && /^G-[A-Z0-9]{1,64}$/.test(value.identifier))
    || (value.provider === 'meta-pixel' && /^[1-9][0-9]{0,31}$/.test(value.identifier));
}

/** No script, pixel or provider request is performed by this client. */
export class AuthorizedTrackingApi {
  private readonly base: string;

  constructor(private readonly scope: Scope, base: string, private readonly fetcher: typeof fetch = fetch) {
    const url = new URL(base);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || ['.localhost', '.local', '.test'].some(suffix => url.hostname.endsWith(suffix));
    if (!['app', 'front'].includes(scope) || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Invalid tracking API origin.');
    }
    this.base = url.origin;
  }

  async authorized(permit: ConsentPermit | null, signal?: AbortSignal): Promise<AuthorizedTracker[]> {
    if (!permit || signal?.aborted || !isCredential(permit.credential)
      || !/^[a-f0-9]{32}$/.test(permit.version) || !Number.isFinite(permit.expiresAt)
      || permit.expiresAt <= Date.now()) return [];

    const timeout = AbortSignal.timeout(10000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await this.fetcher(this.base + '/apiopen/tracking/' + this.scope + '/authorized', {
      method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + permit.credential },
      body: JSON.stringify({ version: permit.version }), signal: requestSignal,
    });
    if (!response.ok) throw new Error('Tracking authorization unavailable.');
    const payload: unknown = await response.json();
    if (!object(payload) || !object(payload.data)) throw new Error('Invalid tracking response.');
    const data = payload.data;
    if (data.version !== permit.version || typeof data.expires_at !== 'string'
      || Date.parse(data.expires_at) !== permit.expiresAt || !Array.isArray(data.trackers)
      || data.trackers.length > 250 || !data.trackers.every(tracker)
      || new Set(data.trackers.map(t => t.subject)).size !== data.trackers.length
      || new Set(data.trackers.map(t => t.provider + ':' + t.identifier)).size !== data.trackers.length) {
      throw new Error('Invalid or stale tracking authorization.');
    }
    if (requestSignal.aborted || permit.expiresAt <= Date.now()) return [];
    return data.trackers;
  }
}
