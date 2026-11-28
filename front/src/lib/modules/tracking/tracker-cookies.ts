/** Expire only known root-path cookies without reading their values. */
export function expireTrackerCookies(document: Pick<Document, 'cookie'>, hostname: string, names: readonly string[], parentDomains = false): void {
  if (names.some(name => !/^[A-Za-z0-9_-]{1,100}$/.test(name))) throw new Error('Invalid tracker cookie name.');
  const domains: string[] = [];
  if (parentDomains && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(hostname) && !/^\d+(?:\.\d+){3}$/.test(hostname)) {
    const labels = hostname.toLowerCase().split('.');
    for (let i = 0; i < labels.length - 1; i++) domains.push(labels.slice(i).join('.'));
  }
  for (const name of names) {
    const expiry = name + '=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/';
    document.cookie = expiry;
    for (const domain of domains) document.cookie = expiry + '; Domain=' + domain;
  }
}
