<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SymSvel\Module\Tracking\TrackingBundle;

final class TrackingBundleTest extends TestCase
{
    public function testBundleCanBeInstantiated(): void
    {
        self::assertInstanceOf(TrackingBundle::class, new TrackingBundle());
    }
}
