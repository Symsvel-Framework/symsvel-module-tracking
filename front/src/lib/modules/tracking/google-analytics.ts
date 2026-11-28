import type { AuthorizedTracker } from './authorized-tracking';
import type { TrackerAdapter, TrackerHandle } from './tracking-runtime';

type GoogleCommand = (...args: unknown[]) => void;
type GoogleWindow = Window & { dataLayer?: unknown[]; gtag?: GoogleCommand };
type Active = { identifier: string; configured: boolean; signal: AbortSignal };

/** GA4 only. No global mutation or third-party request until start(). */
export class GoogleAnalyticsAdapter implements TrackerAdapter {
  private readonly active = new Map<string, Active>();
  private script: HTMLScriptElement | null = null;
  private command: GoogleCommand | null = null;
  private ready = false;
  private failed = false;
  private lastPage: string | null = null;

  constructor(
    private readonly browser: GoogleWindow,
    private readonly document: Document,
    private readonly onError: () => void = () => {}
  ) {}

  start(tracker: AuthorizedTracker, signal: AbortSignal): TrackerHandle {
    if (tracker.provider !== 'google-analytics' || !/^G-[A-Z0-9]{1,64}$/.test(tracker.identifier)
      || signal.aborted || this.failed || this.active.has(tracker.identifier)) {
      throw new Error('Invalid GA4 activation.');
    }
    if (!this.command && (this.browser.gtag !== undefined || this.browser.dataLayer !== undefined)) {
      throw new Error('An unmanaged Google tag is already present.');
    }
    const id = tracker.identifier;
    const entry: Active = { identifier: id, configured: false, signal };
    this.active.set(id, entry);
    this.disable(id, false);
    try {
      if (!this.command) {
        const layer: unknown[] = [];
        this.browser.dataLayer = layer;
        // Google documents an Arguments object as the command queue entry.
        this.command = function () {
          // eslint-disable-next-line prefer-rest-params
          layer.push(arguments);
        };
        this.browser.gtag = this.command;
        this.command('consent', 'default', {
          analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
        });
        this.command('js', new Date());
      }
      if (this.ready) {
        this.configure(entry);
      } else if (!this.script) {
        this.load(id);
      }
    } catch (error) {
      this.stop(entry);
      throw error;
    }
    return { stop: () => this.stop(entry) };
  }

  /** Pass only a route template / explicit public page identifier, never the raw URL. */
  pageView(route: string): void {
    if (!/^\/[a-zA-Z0-9_./\-[\]]{0,249}$/.test(route) || route.startsWith('//') || route === this.lastPage) return;
    this.lastPage = route;
    for (const entry of this.active.values()) {
      if (entry.configured && !entry.signal.aborted) this.sendPage(entry.identifier, route);
    }
  }

  private configure(entry: Active): void {
    if (entry.signal.aborted || this.active.get(entry.identifier) !== entry || entry.configured || !this.command) return;
    this.command('config', entry.identifier, {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      page_location: this.browser.location.origin + '/', page_referrer: '', page_title: ''
    });
    entry.configured = true;
    if (this.lastPage !== null) this.sendPage(entry.identifier, this.lastPage);
  }

  private sendPage(id: string, route: string): void {
    this.command?.('event', 'page_view', {
      send_to: id, page_location: this.browser.location.origin + route, page_referrer: '', page_title: route
    });
  }

  private load(id: string): void {
    const script = this.document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    this.script = script;
    script.onload = () => {
      if (this.script !== script || this.active.size === 0) return;
      this.ready = true;
      try {
        for (const entry of this.active.values()) this.configure(entry);
      } catch {
        this.fail();
      }
    };
    script.onerror = () => {
      if (this.script === script) this.fail();
    };
    this.document.head.appendChild(script);
  }

  private disable(id: string, disabled: boolean): void {
    (this.browser as unknown as Record<string, unknown>)['ga-disable-' + id] = disabled;
  }

  private stop(entry: Active): void {
    if (this.active.get(entry.identifier) !== entry) return;
    this.disable(entry.identifier, true);
    this.active.delete(entry.identifier);
    if (this.active.size === 0) {
      if (this.script && !this.ready) {
        this.script.onload = null;
        this.script.onerror = null;
        this.script.remove();
        this.script = null;
      }
      // Do not delete SDK globals or pretend removing a script unloads JS.
      // A subsequent explicit grant may reconfigure a disabled destination.
    }
  }

  private fail(): void {
    this.failed = true;
    for (const entry of [...this.active.values()]) this.stop(entry);
    this.onError();
  }
}
