import type { Scope } from '../gdpr/consent-client';

const forbidden = new Set(['login','register','activate','forgot-password','reset-password','verify-email','verify-email-change','two-factor','profile','dashboard','account','checkout','payment','payments','admin','privacy','cookies']);
const routePattern = /^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/;

/**
 * Third-party scripts execute with document privileges. Only explicit, public,
 * audited static routes qualify. Never infer safety from the absence of a query.
 */
export class TrackingRoutes {
  private readonly routes: Set<string>;

  constructor(scope: Scope, configured?: string) {
    if (scope !== 'app' && scope !== 'front') throw new Error('Invalid tracking scope.');
    const values = configured === undefined ? (scope === 'front' ? ['/'] : []) : configured.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length > 100 || values.some(value => !routePattern.test(value) || value.split('/').some(segment => forbidden.has(segment.toLowerCase())))) {
      throw new Error('Invalid public tracking route allowlist.');
    }
    this.routes = new Set(values);
  }

  allows(routeId: string | null, url: URL): boolean {
    if (!routeId || !this.routes.has(routeId) || url.search || url.hash || url.username || url.password) return false;
    return url.pathname === routeId;
  }
}
