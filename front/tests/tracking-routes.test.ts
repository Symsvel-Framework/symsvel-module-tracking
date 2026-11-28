import { describe, expect, it } from 'vitest';
import { TrackingRoutes } from './tracking-routes';

describe('public tracking route gate', () => {
  it('defaults to the public Front root and no App tracking', () => {
    expect(new TrackingRoutes('front').allows('/', new URL('https://front.example.test/'))).toBe(true);
    expect(new TrackingRoutes('app').allows('/', new URL('https://app.example.test/'))).toBe(false);
    expect(new TrackingRoutes('front', '').allows('/', new URL('https://front.example.test/'))).toBe(false);
  });
  it('requires an explicit audited static path and the exact actual URL', () => {
    const gate = new TrackingRoutes('app', '/,/about,/products');
    expect(gate.allows('/about', new URL('https://app.example.test/about'))).toBe(true);
    for (const path of ['/about?token=secret', '/about#private', '/about/', '/products/42', '/profile']) {
      expect(gate.allows('/about', new URL('https://app.example.test' + path))).toBe(false);
    }
    expect(gate.allows('/products/[id]', new URL('https://app.example.test/products/42'))).toBe(false);
  });
  it('rejects known private and authentication routes and invalid syntax', () => {
    for (const route of ['/login','/dashboard','/account/orders','/reset-password','/products/[id]','//other.example.test','/about?x=1','/profile/edit']) {
      expect(() => new TrackingRoutes('front', route)).toThrow();
    }
  });
});
