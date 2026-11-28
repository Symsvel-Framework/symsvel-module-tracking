import type { ConsentPermit, Scope } from '../gdpr/consent-client';
import type { ConsentConsumer } from '../gdpr/consent-consumer';
import { AuthorizedTrackingApi } from './authorized-tracking';
import { GoogleAnalyticsAdapter } from './google-analytics';
import { MetaPixelAdapter } from './meta-pixel';
import { TrackingRoutes } from './tracking-routes';
import { TrackingRuntime, type TrackerAdapter } from './tracking-runtime';

/** One consumer per document. No third-party side effects until a valid projection. */
export class TrackingConsentConsumer implements ConsentConsumer {
  private readonly routes: TrackingRoutes;
  private readonly runtime: TrackingRuntime;
  private readonly google: GoogleAnalyticsAdapter;
  private readonly meta: MetaPixelAdapter;
  private permit: ConsentPermit | null = null;
  private route: { id: string; href: string } | null = null;
  private touched = false;
  private retired = false;
  private disposed = false;
  private expiry: number | undefined;
  private readonly interval: number;

  constructor(scope: Scope, apiOrigin: string, private readonly browser: Window,
    private readonly document: Document, configuredRoutes?: string, fetcher: typeof fetch = fetch) {
    this.routes = new TrackingRoutes(scope, configuredRoutes);
    const api = new AuthorizedTrackingApi(scope, apiOrigin, fetcher);
    this.google = new GoogleAnalyticsAdapter(browser, document, this.providerFailed);
    this.meta = new MetaPixelAdapter(browser, document, this.providerFailed);
    const guarded = (adapter: TrackerAdapter): TrackerAdapter => ({
      start: (tracker, signal) => {
        if (!this.eligible() || signal.aborted) throw new Error('Tracking route or permit is stale.');
        // Even a partially executed SDK is a document-level side effect.
        this.touched = true;
        return adapter.start(tracker, signal);
      }
    });
    this.runtime = new TrackingRuntime(api, {
      'google-analytics': guarded(this.google),
      'meta-pixel': guarded(this.meta)
    }, () => { this.retired = true; });
    this.interval = browser.setInterval(this.refresh, 60000);
    document.addEventListener('visibilitychange', this.refresh);
    browser.addEventListener('pagehide', this.pageHide);
    browser.addEventListener('pageshow', this.pageShow);
  }

  setPermit(value: ConsentPermit | null): void {
    if (this.disposed) return;
    const next = value && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() ? { ...value } : null;
    const previous = this.permit;
    const unchanged = previous === null && next === null || previous !== null && next !== null
      && previous.credential === next.credential && previous.version === next.version
      && previous.expiresAt === next.expiresAt;
    if (unchanged) return;
    this.clearExpiry();
    this.permit = next;
    if (this.touched) this.retire();
    else void this.runtime.setPermit(null);
    this.scheduleExpiry();
    this.activate();
  }

  routeChanged(id: string | null, url: URL): void {
    if (this.disposed) return;
    const next = id && url.href === this.browser.location.href && this.routes.allows(id, url)
      ? { id, href: url.href } : null;
    if (next && this.route?.id === next.id && this.route.href === next.href) return;
    this.route = null;
    if (this.touched) this.retire();
    else void this.runtime.setPermit(null);
    this.route = next;
    this.activate();
  }

  requiresDocumentNavigation(): boolean {
    return this.touched;
  }

  selectionCommitted(): void {
    // GDPR publishes null BEFORE sending the PUT. Never interrupt that PUT.
    if (!this.disposed && this.touched && this.retired) this.browser.location.reload();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearExpiry();
    this.browser.clearInterval(this.interval);
    this.document.removeEventListener('visibilitychange', this.refresh);
    this.browser.removeEventListener('pagehide', this.pageHide);
    this.browser.removeEventListener('pageshow', this.pageShow);
    this.permit = null;
    this.route = null;
    this.runtime.dispose();
  }

  private eligible(): boolean {
    return !this.disposed && !this.retired && this.permit !== null && this.permit.expiresAt > Date.now()
      && this.route !== null && this.route.href === this.browser.location.href;
  }

  private activate(): void {
    if (!this.eligible() || !this.route) return;
    this.google.pageView(this.route.id);
    this.meta.pageView(this.route.id);
    void this.runtime.setPermit(this.permit);
  }

  private retire(): void {
    this.retired = true;
    this.runtime.dispose();
  }

  private readonly providerFailed = (): void => {
    this.retire();
  };

  private clearExpiry(): void {
    if (this.expiry !== undefined) this.browser.clearTimeout(this.expiry);
    this.expiry = undefined;
  }

  private scheduleExpiry(): void {
    if (!this.permit || this.disposed) return;
    const delay = Math.max(0, Math.min(this.permit.expiresAt - Date.now(), 2147483647));
    this.expiry = this.browser.setTimeout(() => {
      this.expiry = undefined;
      if (this.permit && this.permit.expiresAt <= Date.now()) this.setPermit(null);
      else this.scheduleExpiry();
    }, delay);
  }

  private readonly refresh = (): void => {
    if (this.permit && this.permit.expiresAt <= Date.now()) {
      this.setPermit(null);
      return;
    }
    if (this.document.visibilityState === 'visible') this.activate();
  };

  private readonly pageHide = (): void => {
    if (this.touched) this.retire();
    else void this.runtime.setPermit(null);
  };

  private readonly pageShow = (event: PageTransitionEvent): void => {
    if (!event.persisted || this.disposed) return;
    if (this.touched) this.browser.location.reload();
    else this.refresh();
  };
}

/** Exact optional entry consumed by the GDPR runtime; safe to import during SSR. */
export function createConsentConsumer(scope: Scope, apiOrigin: string): ConsentConsumer {
  return new TrackingConsentConsumer(scope, apiOrigin, window, document, import.meta.env.PUBLIC_TRACKING_ROUTES);
}
