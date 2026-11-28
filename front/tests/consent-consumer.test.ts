import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrackingConsentConsumer } from './consent-consumer';
import type { ConsentPermit } from '../gdpr/consent-client';
import type { AuthorizedTracker } from './authorized-tracking';

const permit: ConsentPermit = { credential: 'a'.repeat(64) + '.' + 'b'.repeat(64),
  version: '1'.repeat(32), expiresAt: Date.parse('2099-01-01T00:00:00Z') };
const ga: AuthorizedTracker = { subject: 'tracker-' + 'a'.repeat(32), revision: 1, provider: 'google-analytics', identifier: 'G-ABC' };
const meta: AuthorizedTracker = { subject: 'tracker-' + 'b'.repeat(32), revision: 1, provider: 'meta-pixel', identifier: '123' };
function response(trackers: AuthorizedTracker[], value = permit): Response {
  return new Response(JSON.stringify({ data: { version: value.version, expires_at: new Date(value.expiresAt).toISOString(), trackers } }));
}
const consumers: TrackingConsentConsumer[] = [];
afterEach(() => { for (const consumer of consumers.splice(0)) consumer.dispose(); vi.useRealTimers(); });
function fixture(scope: 'front' | 'app' = 'front', configured?: string) {
  const scripts: {src: string; onload: (() => void) | null; onerror: (() => void) | null; remove: ReturnType<typeof vi.fn>}[] = [];
  const browserEvents = new EventTarget();
  const documentEvents = new EventTarget();
  const reload = vi.fn();
  const browser = Object.assign(browserEvents, { location: Object.assign(new URL('https://example.test/'), { reload }),
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval });
  const document = Object.assign(documentEvents, { visibilityState: 'visible', cookie: '',
    createElement: () => ({ src: '', onload: null, onerror: null, remove: vi.fn() }),
    head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) } });
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response([ga, meta]));
  const consumer = new TrackingConsentConsumer(scope, 'https://api.example.test', browser as unknown as Window,
    document as unknown as Document, configured, fetcher);
  consumers.push(consumer);
  consumer.routeChanged('/', new URL(browser.location.href));
  return { consumer, browser, document, scripts, reload, fetcher };
}
async function settle() { await vi.waitFor(() => expect(true).toBe(true)); await new Promise(resolve => setTimeout(resolve, 0)); }

describe('Tracking GDPR consumer', () => {
  it('starts nothing without a permit, or after an empty authorized projection', async () => {
    const f = fixture();
    f.consumer.setPermit(null);
    expect(f.fetcher).not.toHaveBeenCalled();
    f.fetcher.mockResolvedValueOnce(response([]));
    f.consumer.setPermit(permit);
    await settle();
    expect(f.fetcher).toHaveBeenCalledOnce();
    expect(f.scripts).toHaveLength(0);
    expect(f.consumer.requiresDocumentNavigation()).toBe(false);
  });
  it('does not project in App without an audited route or on a query-bearing page', async () => {
    const f = fixture('app');
    f.consumer.setPermit(permit);
    const g = fixture('front');
    g.browser.location.search = '?secret=1';
    g.consumer.routeChanged('/', new URL(g.browser.location.href));
    g.consumer.setPermit(permit);
    await settle();
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(g.fetcher).not.toHaveBeenCalled();
  });
  it('mounts both authorized adapters and only resets after a confirmed selection', async () => {
    const f = fixture();
    f.consumer.setPermit(permit);
    await vi.waitFor(() => expect(f.scripts).toHaveLength(2));
    for (const script of f.scripts) script.onload?.();
    expect(f.consumer.requiresDocumentNavigation()).toBe(true);
    f.consumer.setPermit(null);
    expect(f.browser).toHaveProperty('ga-disable-G-ABC', true);
    expect(f.reload).not.toHaveBeenCalled();
    f.consumer.setPermit({ ...permit, version: '2'.repeat(32) });
    expect(f.fetcher).toHaveBeenCalledOnce();
    f.consumer.selectionCommitted();
    expect(f.reload).toHaveBeenCalledOnce();
  });
  it('aborts an in-flight projection before entering another route', async () => {
    const f = fixture();
    let release!: (value: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    f.consumer.setPermit(permit);
    const signal = f.fetcher.mock.calls[0][1]?.signal;
    f.consumer.routeChanged(null, new URL(f.browser.location.href));
    expect(signal?.aborted).toBe(true);
    f.browser.location.pathname = '/profile';
    f.consumer.routeChanged('/profile', new URL(f.browser.location.href));
    release(response([ga, meta]));
    await settle();
    expect(f.scripts).toHaveLength(0);
  });
  it('can recover from an initial network failure on visibility revalidation', async () => {
    const f = fixture();
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    f.consumer.setPermit(permit);
    await settle();
    expect(f.scripts).toHaveLength(0);
    f.document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(f.scripts).toHaveLength(2));
  });
  it('does not reuse an unfinished permit after BFCache restoration', async () => {
    const f = fixture();
    let release!: (value: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    f.consumer.setPermit(permit);
    f.browser.dispatchEvent(new Event('pagehide'));
    f.browser.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    release(response([ga, meta]));
    await settle();
    expect(f.fetcher).toHaveBeenCalledOnce();
    expect(f.scripts).toHaveLength(0);
    f.consumer.setPermit(permit);
    await vi.waitFor(() => expect(f.scripts).toHaveLength(2));
  });
  it('permanently retires a touched GA4 document after a projection error', async () => {
    const f = fixture();
    f.fetcher.mockResolvedValueOnce(response([ga]));
    f.consumer.setPermit(permit);
    await vi.waitFor(() => expect(f.scripts).toHaveLength(1));
    f.scripts[0].onload?.();
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    f.document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(f.browser).toHaveProperty('ga-disable-G-ABC', true));
    f.document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.consumer.requiresDocumentNavigation()).toBe(true);
  });
  it('retires a touched document when the authorized configuration set changes', async () => {
    const f = fixture();
    f.fetcher.mockResolvedValueOnce(response([ga]));
    f.consumer.setPermit(permit);
    await vi.waitFor(() => expect(f.scripts).toHaveLength(1));
    f.scripts[0].onload?.();
    f.document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(f.browser).toHaveProperty('ga-disable-G-ABC', true));
    expect(f.scripts).toHaveLength(1);
    f.document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });
  it('retires the document at pagehide and reloads a cached document on restoration', async () => {
    const f = fixture();
    f.consumer.setPermit(permit);
    await vi.waitFor(() => expect(f.scripts).toHaveLength(2));
    f.browser.dispatchEvent(new Event('pagehide'));
    expect(f.browser).toHaveProperty('ga-disable-G-ABC', true);
    f.browser.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(f.reload).toHaveBeenCalledOnce();
  });
});
