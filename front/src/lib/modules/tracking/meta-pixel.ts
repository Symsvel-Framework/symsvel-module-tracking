import type { AuthorizedTracker } from './authorized-tracking';
import type { TrackerAdapter, TrackerHandle } from './tracking-runtime';
import { expireTrackerCookies } from './tracker-cookies';

type PixelCommand = ((...args: unknown[]) => void) & {
  queue: unknown[][]; callMethod?: (...args: unknown[]) => void;
  push?: PixelCommand; loaded: boolean; version: string; disablePushState: boolean;
};
type PixelWindow = Window & { fbq?: PixelCommand; _fbq?: PixelCommand };
type Entry = { id: string; signal: AbortSignal; initialized: boolean };

export class MetaPixelAdapter implements TrackerAdapter {
  private active = new Map<string, Entry>();
  private pixel: PixelCommand | null = null;
  private script: HTMLScriptElement | null = null;
  private ready = false;
  private retired = false;
  private lastPage: string | null = null;

  constructor(private readonly browser: PixelWindow, private readonly document: Document,
    private readonly onError: () => void = () => {}) {}

  start(tracker: AuthorizedTracker, signal: AbortSignal): TrackerHandle {
    if (tracker.provider !== 'meta-pixel' || !/^[1-9][0-9]{0,31}$/.test(tracker.identifier)
      || signal.aborted || this.retired || this.active.has(tracker.identifier)) throw new Error('Invalid Meta activation.');
    if (!this.pixel && (this.browser.fbq !== undefined || this.browser._fbq !== undefined)) {
      throw new Error('Unmanaged Meta Pixel already present.');
    }
    const entry: Entry = { id: tracker.identifier, signal, initialized: false };
    this.active.set(entry.id, entry);
    try {
      if (!this.pixel) {
        const pixel = Object.assign((...args: unknown[]) => {
          if (pixel.callMethod) pixel.callMethod(...args);
          else pixel.queue.push(args);
        }, { queue: [] as unknown[][], loaded: true, version: '2.0', disablePushState: true }) as PixelCommand;
        pixel.push = pixel;
        this.pixel = pixel;
        this.browser.fbq = pixel;
        this.browser._fbq = pixel;
        pixel('consent', 'revoke');
        this.load();
      }
      if (this.ready) this.initialize(entry);
    } catch (error) {
      this.revoke();
      throw error;
    }
    return { stop: () => {
      if (this.active.get(entry.id) !== entry) return;
      // Meta's consent command is global. Never grant again in a document
      // containing a previously initialized but subsequently refused pixel.
      this.revoke();
      throw new Error('Meta Pixel consent changed; document reset required.');
    }};
  }

  /** Host must restrict this adapter to pages whose actual URL and DOM are safe for Meta. */
  pageView(route: string): void {
    if (this.retired || !/^\/[a-zA-Z0-9_./-]{0,249}$/.test(route) || route.startsWith('//')
      || this.browser.location.pathname !== route || this.browser.location.search || this.browser.location.hash
      || route === this.lastPage) return;
    this.lastPage = route;
    for (const entry of this.active.values()) {
      if (entry.initialized && !entry.signal.aborted) this.pixel?.('trackSingle', entry.id, 'PageView');
    }
  }

  private load(): void {
    const script = this.document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    this.script = script;
    script.onload = () => {
      if (this.retired || this.script !== script || !this.pixel) return;
      try {
        if ([...this.active.values()].some(entry => entry.signal.aborted)) {
          this.revoke();
          return;
        }
        this.pixel('consent', 'grant');
        this.ready = true;
        for (const entry of this.active.values()) this.initialize(entry);
      } catch {
        this.revoke();
        this.onError();
      }
    };
    script.onerror = () => {
      if (this.script !== script) return;
      this.revoke();
      this.onError();
    };
    this.document.head.appendChild(script);
  }

  private initialize(entry: Entry): void {
    if (!this.pixel || this.retired || entry.signal.aborted || entry.initialized) return;
    this.pixel('set', 'autoConfig', false, entry.id);
    this.pixel('init', entry.id);
    entry.initialized = true;
    if (this.lastPage !== null && this.browser.location.pathname === this.lastPage
      && !this.browser.location.search && !this.browser.location.hash) {
      this.pixel('trackSingle', entry.id, 'PageView');
    }
  }

  private revoke(): void {
    this.retired = true;
    this.active.clear();
    try {
      this.pixel?.('consent', 'revoke');
    } finally {
      expireTrackerCookies(this.document, this.browser.location.hostname, ['_fbp', '_fbc'], true);
    }
    if (this.script && !this.ready) {
      this.script.onload = null;
      this.script.onerror = null;
      this.script.remove();
      this.script = null;
    }
  }
}
