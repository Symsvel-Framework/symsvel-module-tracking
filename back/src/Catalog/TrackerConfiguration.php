<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Catalog;

use SymSvel\Module\Tracking\Provider\TrackerProviderRegistry;

/** A validated catalogue entry and public provider identifier, never script content. */
final readonly class TrackerConfiguration
{
    public string $identifier;

    public function __construct(
        public TrackerDefinition $definition,
        string $identifier,
        TrackerProviderRegistry $providers,
    ) {
        $this->identifier = $providers->normalizeIdentifier($definition->provider, $identifier);
    }
}
