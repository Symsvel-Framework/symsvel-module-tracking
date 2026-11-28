import { describe, expect, it } from 'vitest';
import { expireTrackerCookies } from './tracker-cookies';

describe('tracker-owned cookies', () => {
  it('never reads cookie values and expires only explicit names', () => {
    const writes: string[] = [];
    const document = { get cookie(): string { throw new Error('Must not read cookies'); }, set cookie(value: string) { writes.push(value); } };
    expireTrackerCookies(document, 'front.example.test', ['symsvel_ga_ABC']);
    expect(writes).toEqual(['symsvel_ga_ABC=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/']);
    expect(() => expireTrackerCookies(document, 'front.example.test', ['valid', 'bad; Path=/'])).toThrow();
    expect(writes).toHaveLength(1);
  });
  it('tries known names on parent domains but not a TLD or IP', () => {
    const writes: string[] = [];
    const document = { get cookie() { return ''; }, set cookie(value: string) { writes.push(value); } };
    expireTrackerCookies(document, 'front.example.test', ['_fbp', '_fbc'], true);
    expect(writes).toHaveLength(6);
    expect(writes.filter(value => value.includes('Domain=')).map(value => value.split('Domain=')[1]))
      .toEqual(['front.example.test', 'example.test', 'front.example.test', 'example.test']);
    writes.length = 0;
    expireTrackerCookies(document, '127.0.0.1', ['_fbp'], true);
    expect(writes).toHaveLength(1);
  });
});
