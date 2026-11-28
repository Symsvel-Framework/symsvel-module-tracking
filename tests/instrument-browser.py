"""Instrument only the synthetic Chromium assembly, never distributed module sources."""
from pathlib import Path
import sys

root = Path(sys.argv[1]) / "src/lib/modules"

def insert(file, anchor, replacement):
    path = root / file
    source = path.read_text()
    if source.count(anchor) != 1:
        raise RuntimeError(f"Diagnostic anchor changed: {file}: {anchor}")
    path.write_text(source.replace(anchor, replacement, 1))

insert("gdpr/Runtime.svelte", "    bridge.attach(factory, scope, apiOrigin);",
       """    console.info('[tracking-ci] mount', JSON.stringify({ factory: typeof factory, scope, route: page.route.id, path: location.pathname, apiConfigured: Boolean(apiOrigin) }));
    bridge.attach(factory, scope, apiOrigin);""")
insert("gdpr/consent-consumer.ts", "    if (this.disposed || this.consumer || !factory) return;",
       """    console.info('[tracking-ci] attach', JSON.stringify({ disposed: this.disposed, attached: Boolean(this.consumer), factory: typeof factory }));
    if (this.disposed || this.consumer || !factory) return;""")
insert("gdpr/consent-consumer.ts", "      const consumer = factory(scope, apiOrigin);",
       """      const consumer = factory(scope, apiOrigin);
      console.info('[tracking-ci] attached');""")
insert("gdpr/consent-consumer.ts", "    } catch {\n      this.dispose();\n    }\n  }\n\n  publish",
       """    } catch (error) {
      console.info('[tracking-ci] attach failed', error instanceof Error ? error.message : 'unknown');
      this.dispose();
    }
  }

  publish""")
insert("gdpr/consent-consumer.ts", "  publish(value: ConsentPermit | null): void {",
       """  publish(value: ConsentPermit | null): void {
    console.info('[tracking-ci] publish', JSON.stringify({ permit: Boolean(value), disposed: this.disposed, attached: Boolean(this.consumer) }));""")
insert("gdpr/consent-consumer.ts", "    this.route = { id, url: new URL(url.href) };",
       """    console.info('[tracking-ci] bridge route', JSON.stringify({ id, path: url.pathname }));
    this.route = { id, url: new URL(url.href) };""")
insert("tracking/consent-consumer.ts", "    this.routes = new TrackingRoutes(scope, configuredRoutes);",
       """    console.info('[tracking-ci] constructor', JSON.stringify({ scope, configuredRoutes: configuredRoutes ?? null }));
    this.routes = new TrackingRoutes(scope, configuredRoutes);""")
insert("tracking/consent-consumer.ts", "  routeChanged(id: string | null, url: URL): void {",
       """  routeChanged(id: string | null, url: URL): void {
    console.info('[tracking-ci] consumer route', JSON.stringify({ id, path: url.pathname, sameUrl: url.href === this.browser.location.href, allowed: this.routes.allows(id, url) }));""")
insert("tracking/consent-consumer.ts", "  private activate(): void {",
       """  private activate(): void {
    console.info('[tracking-ci] activate', JSON.stringify({ disposed: this.disposed, retired: this.retired, permit: Boolean(this.permit), route: this.route?.id ?? null, eligible: this.eligible() }));""")
insert("tracking/authorized-tracking.ts", "    if (!permit || signal?.aborted || !isCredential(permit.credential)",
       """    console.info('[tracking-ci] projection', JSON.stringify({ permit: Boolean(permit), aborted: Boolean(signal?.aborted), validCredential: isCredential(permit?.credential), validVersion: /^[a-f0-9]{32}$/.test(permit?.version ?? ''), current: Boolean(permit && permit.expiresAt > Date.now()) }));
    if (!permit || signal?.aborted || !isCredential(permit.credential)""")
