import { describe, expect, it, vi } from 'vitest';
import { GoogleAnalyticsAdapter } from './google-analytics';
import type { AuthorizedTracker } from './authorized-tracking';

const tracker: AuthorizedTracker = { subject: 'tracker-' + 'a'.repeat(32), revision: 1, provider: 'google-analytics', identifier: 'G-ABC' };
function fixture() {
  const script = { async: false, referrerPolicy: '', src: '', onload: null as (() => void) | null,
    onerror: null as (() => void) | null, remove: vi.fn() };
  const append = vi.fn();
  const browser: Record<string, unknown> = { location: { origin: 'https://example.test' } };
  const document = { createElement: vi.fn(() => script), head: { appendChild: append } };
  const error = vi.fn();
  const adapter = new GoogleAnalyticsAdapter(browser as unknown as Window, document as unknown as Document, error);
  const commands = () => (browser.dataLayer as ArrayLike<unknown>[] ?? []).map(entry => Array.from(entry));
  return { adapter, browser, script, append, error, commands };
}
describe('native GA4 adapter', () => {
  it('does not mutate the window or load a script before activation', () => {
    const f = fixture();
    f.adapter.pageView('/home');
    expect(f.append).not.toHaveBeenCalled();
    expect(f.browser).not.toHaveProperty('dataLayer');
  });
  it('loads one native script, configures only granted destinations and emits explicit pageviews', () => {
    const f = fixture();
    const signal = new AbortController().signal;
    f.adapter.pageView('/products/[id]');
    const one = f.adapter.start(tracker, signal);
    const two = f.adapter.start({ ...tracker, identifier: 'G-SECOND' }, signal);
    expect(f.append).toHaveBeenCalledTimes(1);
    expect(f.script.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-ABC');
    expect(f.commands()[0]).toEqual(['consent', 'default', expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'denied' })]);
    expect(f.commands().some(c => c[0] === 'config')).toBe(false);
    f.script.onload?.();
    expect(f.commands().filter(c => c[0] === 'config').map(c => c[1])).toEqual(['G-ABC', 'G-SECOND']);
    expect(f.commands().filter(c => c[0] === 'event')).toHaveLength(2);
    one.stop();
    expect(f.browser['ga-disable-G-ABC']).toBe(true);
    f.adapter.pageView('/about');
    expect(f.commands().at(-1)).toEqual(['event', 'page_view', expect.objectContaining({send_to: 'G-SECOND', page_location: 'https://example.test/about'})]);
    const count = f.commands().length;
    f.adapter.pageView('/about?token=private');
    f.adapter.pageView('/about');
    expect(f.commands()).toHaveLength(count);
    two.stop();
    expect(f.browser['ga-disable-G-SECOND']).toBe(true);
  });
  it('stops pending initialization on withdrawal before SDK load', () => {
    const f = fixture();
    const handle = f.adapter.start(tracker, new AbortController().signal);
    const late = f.script.onload;
    handle.stop();
    late?.();
    expect(f.script.remove).toHaveBeenCalledOnce();
    expect(f.browser['ga-disable-G-ABC']).toBe(true);
    expect(f.commands().some(c => c[0] === 'config')).toBe(false);
  });
  it('does not overwrite an existing unmanaged tag', () => {
    const f = fixture();
    f.browser.dataLayer = [];
    expect(() => f.adapter.start(tracker, new AbortController().signal)).toThrow();
    expect(f.append).not.toHaveBeenCalled();
  });
  it('fails closed if the SDK fails to load', () => {
    const f = fixture();
    f.adapter.start(tracker, new AbortController().signal);
    f.script.onerror?.();
    expect(f.browser['ga-disable-G-ABC']).toBe(true);
    expect(f.error).toHaveBeenCalledOnce();
    expect(() => f.adapter.start(tracker, new AbortController().signal)).toThrow();
  });
});
