import type { ConsentPermit } from '../gdpr/consent-client';
import type { AuthorizedTracker, AuthorizedTrackingApi } from './authorized-tracking';

/** Adapter owns its SDK, including stopping a partially started instance. */
export interface TrackerHandle {
  stop(): void;
}
export interface TrackerAdapter {
  start(tracker: AuthorizedTracker, signal: AbortSignal): TrackerHandle;
}
type AdapterMap = Partial<Record<AuthorizedTracker['provider'], TrackerAdapter>>;

function signature(tracker: AuthorizedTracker): string {
  return JSON.stringify([tracker.subject, tracker.revision, tracker.provider, tracker.identifier]);
}

/** One instance per host. No SDK is imported or started by construction. */
export class TrackingRuntime {
  private generation = 0;
  private pending: AbortController | null = null;
  private permit: ConsentPermit | null = null;
  private active = new Map<string, TrackerHandle>();
  private disposed = false;
  private unsafe = false;

  constructor(
    private readonly api: Pick<AuthorizedTrackingApi, 'authorized'>,
    private readonly adapters: AdapterMap,
    private readonly onStopFailure: () => void = () => {},
    private readonly onProjectionInvalidated: () => void = () => {}
  ) {}

  /** A null or changed permit stops existing handles synchronously, before any await. */
  async setPermit(next: ConsentPermit | null): Promise<void> {
    if (this.disposed || this.unsafe) return;
    if (next !== null && (!Number.isFinite(next.expiresAt) || next.expiresAt <= Date.now())) next = null;
    const unchanged = this.permit !== null && next !== null
      && this.permit.version === next.version && this.permit.credential === next.credential
      && this.permit.expiresAt === next.expiresAt;
    if (unchanged) { await this.revalidate(); return; }
    this.invalidate();
    this.permit = next === null ? null : { ...next };
    if (this.permit !== null && !this.unsafe) await this.revalidate();
  }

  /** Call on visibility regain and periodically; failure is fail-closed. */
  async revalidate(): Promise<void> {
    const permit = this.permit;
    if (this.disposed || this.unsafe || permit === null) return;
    if (permit.expiresAt <= Date.now()) {
      this.invalidate();
      return;
    }
    this.pending?.abort();
    const generation = ++this.generation;
    const controller = new AbortController();
    this.pending = controller;
    const current = () => !this.disposed && !this.unsafe && this.generation === generation
      && !controller.signal.aborted && permit.expiresAt > Date.now();
    try {
      const configurations = await this.api.authorized(permit, controller.signal);
      if (!current()) {
        if (this.generation === generation) { this.invalidate(); this.notifyProjectionInvalidated(); }
        return;
      }
      if (configurations.some(t => !this.adapters[t.provider])) throw new Error('Missing native tracker adapter.');
      const desired = new Set(configurations.map(signature));
      if (desired.size !== configurations.length) throw new Error('Duplicate tracker configuration.');
      // A document-level host may retire the entire document instead of
      // reconciling a changed projection after any SDK has been executed.
      if (this.active.size > 0 && (desired.size !== this.active.size
        || [...this.active.keys()].some(key => !desired.has(key)))) {
        this.notifyProjectionInvalidated();
        if (!current()) return;
      }
      for (const [key, handle] of this.active) {
        if (!desired.has(key)) {
          this.active.delete(key);
          this.stop(handle);
        }
      }
      if (this.unsafe) {
        this.invalidate();
        return;
      }
      if (!current()) return;
      for (const tracker of configurations) {
        const key = signature(tracker);
        if (this.active.has(key)) continue;
        if (!current()) return;
        const handle = this.adapters[tracker.provider]!.start(tracker, controller.signal);
        if (!current()) {
          this.stop(handle);
          return;
        }
        this.active.set(key, handle);
      }
    } catch {
      if (this.generation === generation) { this.invalidate(); this.notifyProjectionInvalidated(); }
    } finally {
      if (this.pending === controller) this.pending = null;
    }
  }

  /** Permanent disposal: subsequent responses and permits are ignored. */
  dispose(): void {
    this.disposed = true;
    this.invalidate();
  }

  private invalidate(): void {
    this.generation++;
    this.pending?.abort();
    this.pending = null;
    this.permit = null;
    const handles = [...this.active.values()];
    this.active.clear();
    for (const handle of handles) this.stop(handle);
  }

  private notifyProjectionInvalidated(): void {
    try { this.onProjectionInvalidated(); } catch { /* fail closed through the current runtime */ this.invalidate(); }
  }

  private stop(handle: TrackerHandle): void {
    try {
      handle.stop();
    } catch {
      // A failed shutdown must not be followed by another SDK activation.
      if (!this.unsafe) {
        this.unsafe = true;
        this.pending?.abort();
        // Notify the host once; it must provide a safe document reset.
        try { this.onStopFailure(); } catch { /* fail closed */ }
      }
    }
  }
}
