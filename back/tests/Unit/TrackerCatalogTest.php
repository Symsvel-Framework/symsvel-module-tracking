<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SymSvel\Module\Tracking\Catalog\TrackerCatalog;
use SymSvel\Module\Tracking\Catalog\TrackerDefinition;

final class TrackerCatalogTest extends TestCase
{
    private function tracker(string $id, array $scopes, bool $active = true, int $revision = 1, string $url = 'https://example.invalid/privacy'): TrackerDefinition
    {
        return new TrackerDefinition($id, 'example-provider', 'Example', 'Audience', 'Audience measurement', $url, $scopes, $active, $revision);
    }

    public function testScopeProjectionIsDeterministicAndExcludesInactiveEntries(): void
    {
        $catalog = new TrackerCatalog([
            $this->tracker('zeta', ['front']),
            $this->tracker('inactive', ['front', 'app'], false),
            $this->tracker('alpha', ['app', 'front']),
            $this->tracker('app-only', ['app']),
        ]);

        self::assertSame(['alpha', 'zeta'], array_map(static fn (TrackerDefinition $t): string => $t->id, $catalog->activeForScope('front')));
        self::assertSame(['alpha', 'app-only'], array_map(static fn (TrackerDefinition $t): string => $t->id, $catalog->activeForScope('app')));
        self::assertSame([], $catalog->activeForScope('bo'));
        self::assertSame([], $catalog->activeForScope('unknown'));
    }

    public function testRevisionAndScopeAreBoundToCurrentActiveConfiguration(): void
    {
        $catalog = new TrackerCatalog([$this->tracker('analytics', ['front'], true, 2), $this->tracker('inactive', ['front'], false)]);
        self::assertTrue($catalog->hasCurrentRevision('front', 'analytics', 2));
        self::assertFalse($catalog->hasCurrentRevision('front', 'analytics', 1));
        self::assertFalse($catalog->hasCurrentRevision('app', 'analytics', 2));
        self::assertFalse($catalog->hasCurrentRevision('bo', 'analytics', 2));
        self::assertFalse($catalog->hasCurrentRevision('front', 'unknown', 2));
        self::assertFalse($catalog->hasCurrentRevision('front', 'inactive', 1));
    }

    public function testDuplicateTrackerFailsClosed(): void
    {
        $this->expectException(\LogicException::class);
        new TrackerCatalog([$this->tracker('analytics', ['front']), $this->tracker('analytics', ['app'])]);
    }

    public function testBoCannotBeConfigured(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->tracker('analytics', ['front', 'bo']);
    }

    public function testRejectsUnsafePrivacyUrl(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->tracker('analytics', ['front'], true, 1, 'javascript:alert(1)');
    }

    public function testRejectsNonPositiveRevision(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->tracker('analytics', ['front'], true, 0);
    }
}
