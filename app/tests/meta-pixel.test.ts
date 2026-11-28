import { describe, expect, it, vi } from 'vitest';
import { MetaPixelAdapter } from './meta-pixel';
import type { AuthorizedTracker } from './authorized-tracking';
const tracker: AuthorizedTracker = { subject: 'tracker-' + 'a'.repeat(32), revision: 1, provider: 'meta-pixel', identifier: '123' };
function fixture() {
  const script = { async: false, referrerPolicy: '', src: '', onload: null as (() => void) | null,
    onerror: null as (() => void) | null, remove: vi.fn() };
  const append = vi.fn();
  const browser: Record<string, unknown> = { location: { pathname: '/home', search: '', hash: '', hostname: 'front.example.test' } };
  const expired: string[] = [];
  const document = { createElement: vi.fn(() => script), head: { appendChild: append }, set cookie(value: string) { expired.push(value); } };
  const error = vi.fn();
  const adapter = new MetaPixelAdapter(browser as unknown as Window, document as unknown as Document, error);
  const commands = () => (browser.fbq as { queue: unknown[][] } | undefined)?.queue ?? [];
  return { adapter, browser, script, append, error, commands, expired };
}
describe('Meta Pixel adapter', () => {
  it('never touches Meta before explicit activation and loads one script for multiple IDs', () => {
    const f = fixture();
    f.adapter.pageView('/home');
    expect(f.append).not.toHaveBeenCalled();
    expect(f.browser.fbq).toBeUndefined();
    const signal = new AbortController().signal;
    f.adapter.start(tracker, signal);
    f.adapter.start({ ...tracker, identifier: '456' }, signal);
    expect(f.append).toHaveBeenCalledOnce();
    expect(f.script.src).toBe('https://connect.facebook.net/en_US/fbevents.js');
    expect(f.commands()).toEqual([['consent', 'revoke']]);
    f.script.onload?.();
    expect(f.commands()).toEqual([
      ['consent', 'revoke'], ['consent', 'grant'], ['set', 'autoConfig', false, '123'],
      ['init', '123'], ['trackSingle', '123', 'PageView'], ['set', 'autoConfig', false, '456'],
      ['init', '456'], ['trackSingle', '456', 'PageView']
    ]);
  });
  it('revokes globally and requires a fresh document after removal of one pixel', () => {
    const f = fixture();
    const signal = new AbortController().signal;
    const first = f.adapter.start(tracker, signal);
    const second = f.adapter.start({ ...tracker, identifier: '456' }, signal);
    f.script.onload?.();
    expect(() => first.stop()).toThrow('document reset required');
    expect(f.commands().at(-1)).toEqual(['consent', 'revoke']);
    expect(new Set(f.expired.map(c => c.split('=')[0]))).toEqual(new Set(['_fbp', '_fbc']));
    second.stop();
    expect(() => f.adapter.start(tracker, signal)).toThrow();
  });
  it('never grants consent if stopped before SDK initialization', () => {
    const f = fixture();
    const handle = f.adapter.start(tracker, new AbortController().signal);
    const late = f.script.onload;
    expect(() => handle.stop()).toThrow();
    late?.();
    expect(f.script.remove).toHaveBeenCalledOnce();
    expect(f.commands().some(args => args[1] === 'grant')).toBe(false);
  });
  it('rejects unmanaged globals and suppresses explicit pageviews on mismatched or query-bearing URLs', () => {
    const f = fixture();
    f.browser._fbq = {};
    expect(() => f.adapter.start(tracker, new AbortController().signal)).toThrow();
    delete f.browser._fbq;
    f.adapter.start(tracker, new AbortController().signal);
    f.script.onload?.();
    f.adapter.pageView('/users/[id]');
    (f.browser.location as {search: string}).search = '?secret=1';
    f.adapter.pageView('/home');
    expect(f.commands().some(args => args[0] === 'trackSingle')).toBe(false);
  });
  it('revokes on load error', () => {
    const f = fixture();
    f.adapter.start(tracker, new AbortController().signal);
    f.script.onerror?.();
    expect(f.error).toHaveBeenCalledOnce();
    expect(f.commands().at(-1)).toEqual(['consent', 'revoke']);
  });
});
