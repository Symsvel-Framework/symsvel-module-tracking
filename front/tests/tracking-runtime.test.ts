import { describe, expect, it, vi } from 'vitest';
import { TrackingRuntime } from './tracking-runtime';
import type { AuthorizedTracker, AuthorizedTrackingApi } from './authorized-tracking';
import type { ConsentPermit } from '../gdpr/consent-client';
const permit: ConsentPermit = { credential: 'a'.repeat(64) + '.' + 'b'.repeat(64),
  version: '1'.repeat(32), expiresAt: Date.parse('2099-01-01T00:00:00Z') };
const ga: AuthorizedTracker = { subject: 'tracker-' + 'a'.repeat(32), revision: 1, provider: 'google-analytics', identifier: 'G-ABC' };
const meta: AuthorizedTracker = { subject: 'tracker-' + 'b'.repeat(32), revision: 1, provider: 'meta-pixel', identifier: '123' };
function fixture() {
  const authorized = vi.fn<AuthorizedTrackingApi['authorized']>().mockResolvedValue([ga, meta]);
  const gaStop = vi.fn();
  const metaStop = vi.fn();
  const gaStart = vi.fn(() => ({ stop: gaStop }));
  const metaStart = vi.fn(() => ({ stop: metaStop }));
  const onStopFailure = vi.fn();
  const runtime = new TrackingRuntime({ authorized }, { 'google-analytics': { start: gaStart }, 'meta-pixel': { start: metaStart } }, onStopFailure);
  return { runtime, authorized, gaStart, metaStart, gaStop, metaStop, onStopFailure };
}
describe('tracking runtime', () => {
  it('does not request or start anything without a permit and can start multiple native providers', async () => {
    const f = fixture();
    await f.runtime.setPermit(null);
    expect(f.authorized).not.toHaveBeenCalled();
    expect(f.gaStart).not.toHaveBeenCalled();
    await f.runtime.setPermit(permit);
    expect(f.gaStart).toHaveBeenCalledTimes(1);
    expect(f.metaStart).toHaveBeenCalledTimes(1);
    await f.runtime.setPermit({ ...permit });
    await f.runtime.revalidate();
    expect(f.gaStart).toHaveBeenCalledTimes(1);
    expect(f.metaStart).toHaveBeenCalledTimes(1);
    const revoked = f.runtime.setPermit(null);
    expect(f.gaStop).toHaveBeenCalledTimes(1);
    expect(f.metaStop).toHaveBeenCalledTimes(1);
    await revoked;
  });
  it('discards a pending response after withdrawal', async () => {
    const f = fixture();
    let release!: (value: AuthorizedTracker[]) => void;
    f.authorized.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = f.runtime.setPermit(permit);
    const signal = f.authorized.mock.calls[0][1]!;
    await f.runtime.setPermit(null);
    expect(signal.aborted).toBe(true);
    release([ga, meta]);
    await pending;
    expect(f.gaStart).not.toHaveBeenCalled();
    expect(f.metaStart).not.toHaveBeenCalled();
  });
  it('stops removed configurations, and stops all on authorization failure', async () => {
    const f = fixture();
    await f.runtime.setPermit(permit);
    f.authorized.mockResolvedValueOnce([meta]);
    await f.runtime.revalidate();
    expect(f.gaStop).toHaveBeenCalledTimes(1);
    expect(f.metaStop).not.toHaveBeenCalled();
    f.authorized.mockRejectedValueOnce(new Error('Unavailable'));
    await f.runtime.revalidate();
    expect(f.metaStop).toHaveBeenCalledTimes(1);
    await f.runtime.revalidate();
    expect(f.authorized).toHaveBeenCalledTimes(3);
  });
  it('invalidates old providers synchronously on a version change and never restarts after disposal', async () => {
    const f = fixture();
    await f.runtime.setPermit(permit);
    const next = f.runtime.setPermit({ ...permit, version: '2'.repeat(32) });
    expect(f.gaStop).toHaveBeenCalledTimes(1);
    expect(f.metaStop).toHaveBeenCalledTimes(1);
    await next;
    f.runtime.dispose();
    await f.runtime.setPermit(permit);
    expect(f.authorized).toHaveBeenCalledTimes(2);
  });
  it('does not restart anything after an adapter shutdown failure', async () => {
    const f = fixture();
    await f.runtime.setPermit(permit);
    f.gaStop.mockImplementationOnce(() => { throw new Error('Stop failed'); });
    await f.runtime.setPermit(null);
    expect(f.metaStop).toHaveBeenCalledTimes(1);
    expect(f.onStopFailure).toHaveBeenCalledTimes(1);
    await f.runtime.setPermit(permit);
    expect(f.authorized).toHaveBeenCalledTimes(1);
  });
  it('refuses all configurations if one native adapter is missing', async () => {
    const f = fixture();
    const runtime = new TrackingRuntime({ authorized: f.authorized }, { 'google-analytics': { start: f.gaStart } });
    await runtime.setPermit(permit);
    expect(f.gaStart).not.toHaveBeenCalled();
  });
});
