<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SymSvel\Module\Tracking\Consent\TrackingPolicy;

final class TrackingPolicyTest extends TestCase
{
    public function testOnlyAppAndFrontAreValidScopes(): void
    {
        $policy = new TrackingPolicy();
        foreach ([['app'], ['front'], ['app', 'front']] as $valid) {
            self::assertTrue($policy->validScopes($valid));
        }
        foreach ([[], ['bo'], ['app', 'bo'], ['unknown'], ['front', 'front'], ['scope' => 'app'], [null], [['app']]] as $invalid) {
            self::assertFalse($policy->validScopes($invalid));
        }
    }

    public function testConfiguredScopeAndConsentAreBothRequired(): void
    {
        $policy = new TrackingPolicy();
        self::assertTrue($policy->canLoad('app', ['app', 'front'], true, true, true, true));
        self::assertTrue($policy->canLoad('front', ['front'], true, true, true, true));
        self::assertFalse($policy->canLoad('app', ['front'], true, true, true, true));
        self::assertFalse($policy->canLoad('bo', ['app', 'front'], true, true, true, true));
        self::assertFalse($policy->canLoad('bo', ['bo'], true, true, true, true));
        self::assertFalse($policy->canLoad('app', ['app', 'bo'], true, true, true, true));
    }

    public function testEveryMissingAuthorizationFailsClosed(): void
    {
        $policy = new TrackingPolicy();
        self::assertFalse($policy->canLoad('front', ['front'], false, true, true, true));
        self::assertFalse($policy->canLoad('front', ['front'], true, false, true, true));
        self::assertFalse($policy->canLoad('front', ['front'], true, true, false, true));
        self::assertFalse($policy->canLoad('front', ['front'], true, true, true, false));
        self::assertFalse($policy->canLoad('front', [], true, true, true, true));
    }
}
