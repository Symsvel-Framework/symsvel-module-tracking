<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Provider;

use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/**
 * Validates public provider identifiers. This contract does not grant
 * permission to load a script and must never accept executable snippets.
 */
#[AutoconfigureTag('symsvel.tracking.provider')]
interface TrackerProvider
{
    public function id(): string;
    public function label(): string;

    /** @throws \InvalidArgumentException for an unsupported identifier. */
    public function normalizeIdentifier(string $identifier): string;
}
