import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const scope = "app";
const origin = 'http://localhost:4173';
const publicUrl = origin + '/tracking-public';
const privateUrl = origin + '/tracking-private';
const ga = { subject: 'tracker-' + 'a'.repeat(32), revision: 1, provider: 'google-analytics', identifier: 'G-ABC' };
const meta = { subject: 'tracker-' + 'b'.repeat(32), revision: 1, provider: 'meta-pixel', identifier: '123' };
const trackers = [ga, meta];
const credential = 'c'.repeat(64) + '.' + 'd'.repeat(64);
test.beforeEach(({ page }) => {
  page.on('pageerror', error => console.log('[browser error]', error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') console.log('[browser]', message.text());
  });
});
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  try {
    console.log('[tracking browser state]', JSON.stringify(await page.evaluate(scope => ({
      path: location.pathname,
      credentialPresent: localStorage.getItem('symsvel.gdpr.' + scope) !== null,
      blocked: localStorage.getItem('symsvel.gdpr.' + scope + '.blocked') !== null,
      gaPresent: 'gtag' in window, metaPresent: 'fbq' in window,
      scripts: Array.from(document.scripts).map(script => script.src).filter(src => src.includes('googletagmanager') || src.includes('facebook.net'))
    }), scope)));
  } catch { /* the document may be navigating */ }
});

const button = (page: Page, name: RegExp) => page.getByRole('button', { name });
const accept = (page: Page) => button(page, /Accept all|Tout accepter/);
const refuse = (page: Page) => button(page, /Refuse all|Tout refuser/);
const preferences = (page: Page) => button(page, /Cookie preferences|Préférences cookies/);

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function fixture(context: BrowserContext) {
  let version: string | null = null;
  let expiresAt: string | null = null;
  let choices: Record<string, { revision: number; granted: boolean }> = {};
  let writes = 0;
  let projections = 0;
  let reads = 0;
  const requests: string[] = [];
  let holdProjection: Promise<void> | null = null;
  let holdWrite: Promise<void> | null = null;
  let failProjection = false;
  let lifetime = 3600000;
  const state = () => ({
    enabled: true, complete: version !== null, version, expires_at: expiresAt,
    purposes: trackers.map(t => ({
      subject: t.subject, revision: t.revision, name: t.provider === 'google-analytics' ? 'GA4 fixture' : 'Meta fixture',
      purpose: 'Audience', description: 'Synthetic test', privacy_url: 'https://example.invalid/privacy',
      decided: version !== null, granted: choices[t.subject]?.granted ?? false
    }))
  });
  // No test may actually reach a third-party host.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.fallback();
    requests.push(url.href);
    if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
      return route.fulfill({ contentType: 'application/javascript', body: 'window.__gaFixtureLoaded = true;' });
    }
    if (url.hostname === 'connect.facebook.net' && url.pathname === '/en_US/fbevents.js') {
      return route.fulfill({ contentType: 'application/javascript', body: 'window.__metaFixtureLoaded = true;' });
    }
    return route.abort();
  });
  await context.route('**/apiopen/project', route => route.fulfill({ json: { data: { name: 'Tracking CT' } } }));
  await context.route('**/apiopen/gdpr/' + scope + '/consent/state', route => {
    reads++;
    const authenticated = route.request().headers()['authorization'] === 'Bearer ' + credential;
    const value = authenticated ? state() : {
      ...state(), complete: false, version: null, expires_at: null,
      purposes: state().purposes.map(p => ({ ...p, decided: false, granted: false }))
    };
    return route.fulfill({ json: { data: value } });
  });
  await context.route('**/apiopen/gdpr/' + scope + '/consent', async route => {
    const input = route.request().postDataJSON();
    const existing = route.request().headers()['authorization'] === 'Bearer ' + credential;
    writes++;
    if (holdWrite) await holdWrite;
    choices = input.choices;
    version = writes.toString(16).padStart(32, '0');
    expiresAt = new Date(Date.now() + lifetime).toISOString();
    return route.fulfill({ json: { data: { ...state(), ...(existing ? {} : { credential }) } } });
  });
  await context.route('**/apiopen/tracking/' + scope + '/authorized', async route => {
    projections++;
    const requestVersion = route.request().postDataJSON().version;
    const snapshot = { version, expires_at: expiresAt, trackers: trackers.filter(t => choices[t.subject]?.granted) };
    if (holdProjection) await holdProjection;
    if (failProjection || requestVersion !== snapshot.version) return route.fulfill({ status: 503, json: {} });
    expect(route.request().headers()['authorization']).toBe('Bearer ' + credential);
    try { await route.fulfill({ json: { data: snapshot } }); } catch { /* navigation may already have aborted this request */ }
  });
  return { requests, writes: () => writes, reads: () => reads, projections: () => projections,
    holdProjection: (value: Promise<void> | null) => { holdProjection = value; },
    holdWrite: (value: Promise<void> | null) => { holdWrite = value; },
    fail: (value: boolean) => { failProjection = value; },
    lifetime: (value: number) => { lifetime = value; } };
}

async function commands(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { dataLayer?: ArrayLike<unknown>[]; fbq?: { queue: unknown[][] };
      'ga-disable-G-ABC'?: boolean; __gaFixtureLoaded?: boolean; __metaFixtureLoaded?: boolean };
    return { ga: (w.dataLayer ?? []).map(item => Array.from(item)), meta: w.fbq?.queue ?? [],
      disabled: w['ga-disable-G-ABC'] === true, loadedGa: w.__gaFixtureLoaded === true,
      loadedMeta: w.__metaFixtureLoaded === true };
  });
}

async function both(page: Page) {
  await expect.poll(async () => (await commands(page)).ga.some(c => c[0] === 'event' && c[1] === 'page_view')).toBe(true);
  await expect.poll(async () => (await commands(page)).meta.some(c => c[0] === 'trackSingle' && c[1] === '123')).toBe(true);
}

test('refusal never projects or loads a third-party SDK', async ({ page, context }) => {
  const f = await fixture(context);
  await page.goto(publicUrl);
  await expect(refuse(page)).toBeVisible();
  expect(f.requests).toEqual([]);
  expect(f.projections()).toBe(0);
  await refuse(page).click();
  await expect(preferences(page)).toBeVisible();
  expect(f.writes()).toBe(1);
  expect(f.projections()).toBe(0);
  expect(f.requests).toEqual([]);
});

test('individual consent loads only GA4; both SDKs can be granted in a new document', async ({ page, context }) => {
  const f = await fixture(context);
  await page.goto(publicUrl);
  await button(page, /Customize|Personnaliser/).click();
  await page.getByRole('checkbox', { name: 'GA4 fixture' }).check();
  await button(page, /Save my choices|Enregistrer/).click();
  await expect.poll(f.writes).toBe(1);
  await expect(preferences(page)).toBeVisible();
  await expect.poll(f.projections).toBeGreaterThan(0);
  await expect.poll(async () => (await commands(page)).loadedGa).toBe(true);
  expect(f.requests).toHaveLength(1);
  expect(f.requests[0]).toContain('gtag/js');
  expect((await commands(page)).loadedMeta).toBe(false);
  await preferences(page).click();
  // A second confirmed selection deliberately reloads a document that touched a SDK.
  // Arm the document-navigation waiter before submitting the choice.
  const reloaded = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
  await accept(page).click();
  await reloaded;
  await page.waitForLoadState('domcontentloaded');
  await expect(preferences(page)).toBeVisible();
  await both(page);
  expect(f.requests.filter(url => url.includes('fbevents.js'))).toHaveLength(1);
});

test('withdrawal stops both SDKs synchronously and does not interrupt the consent PUT', async ({ page, context }) => {
  const f = await fixture(context);
  await page.goto(publicUrl);
  await accept(page).click();
  await both(page);
  await preferences(page).click();
  const held = gate();
  f.holdWrite(held.promise);
  await refuse(page).click();
  try {
    await expect.poll(f.writes).toBe(2);
    await expect.poll(async () => (await commands(page)).disabled).toBe(true);
    expect((await commands(page)).meta.at(-1)).toEqual(['consent', 'revoke']);
    expect(f.requests).toHaveLength(2);
  } finally { held.release(); }
  await expect.poll(f.reads).toBeGreaterThan(1);
  await expect(preferences(page)).toBeVisible();
  expect((await commands(page)).loadedGa).toBe(false);
  expect((await commands(page)).loadedMeta).toBe(false);
  expect(f.requests).toHaveLength(2);
});

test('a navigation to an unaudited page uses a new document and back navigation is safe', async ({ page, context }) => {
  const f = await fixture(context);
  await page.goto(publicUrl);
  await accept(page).click();
  await both(page);
  await page.getByRole('link', { name: 'Private fixture' }).click();
  await expect(page).toHaveURL(privateUrl);
  await expect(page.getByRole('heading', { name: 'Private fixture' })).toBeVisible();
  await expect(preferences(page)).toBeVisible();
  expect((await commands(page)).loadedGa).toBe(false);
  expect((await commands(page)).loadedMeta).toBe(false);
  expect(f.requests).toHaveLength(2);
  await page.goBack();
  await expect(page).toHaveURL(publicUrl);
  await both(page);
  await page.goForward();
  await expect(page).toHaveURL(privateUrl);
  await expect(preferences(page)).toBeVisible();
  expect((await commands(page)).loadedGa).toBe(false);
  expect((await commands(page)).loadedMeta).toBe(false);
});

test('an in-flight projection cannot start a provider after SPA navigation', async ({ page, context }) => {
  const f = await fixture(context);
  const held = gate();
  f.holdProjection(held.promise);
  await page.goto(publicUrl);
  await accept(page).click();
  try {
    await expect.poll(f.writes).toBe(1);
    await expect(preferences(page)).toBeVisible();
    await expect.poll(f.projections).toBe(1);
    await page.getByRole('link', { name: 'Private fixture' }).click();
    await expect(page).toHaveURL(privateUrl);
    await expect(page.getByRole('heading', { name: 'Private fixture' })).toBeVisible();
  } finally { held.release(); }
  await expect(preferences(page)).toBeVisible();
  expect(f.requests).toEqual([]);
  expect((await commands(page)).loadedGa).toBe(false);
  expect((await commands(page)).loadedMeta).toBe(false);
});

test('network failure remains closed and can be retried on visibility revalidation', async ({ page, context }) => {
  const f = await fixture(context);
  f.fail(true);
  await page.goto(publicUrl);
  const failure = page.waitForResponse(r => r.url().endsWith('/authorized') && r.status() === 503);
  await accept(page).click();
  await failure;
  expect(f.requests).toEqual([]);
  f.fail(false);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await both(page);
});

test('expiry stops the active SDKs without waiting for a network response', async ({ page, context }) => {
  const f = await fixture(context);
  f.lifetime(600000);
  await page.clock.install();
  await page.goto(publicUrl);
  await accept(page).click();
  await both(page);
  await page.clock.fastForward(660000);
  await expect.poll(async () => (await commands(page)).disabled).toBe(true);
  expect((await commands(page)).meta.at(-1)).toEqual(['consent', 'revoke']);
  expect(f.requests).toHaveLength(2);
});

test('a refusal in another tab stops active providers in the first tab', async ({ page, context }) => {
  const f = await fixture(context);
  await page.goto(publicUrl);
  await accept(page).click();
  await both(page);
  const other = await context.newPage();
  await other.goto(publicUrl);
  await both(other);
  await preferences(other).click();
  await refuse(other).click();
  await expect.poll(async () => (await commands(page)).disabled).toBe(true);
  expect((await commands(page)).meta.at(-1)).toEqual(['consent', 'revoke']);
  await expect(preferences(other)).toBeVisible();
  expect(f.requests).toHaveLength(4);
});
