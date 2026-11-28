<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Catalog;

use SymSvel\Module\Tracking\Consent\TrackingPolicy;

/**
 * Internal catalogue metadata. Provider-specific technical configuration
 * is deliberately separate and must be validated by its adapter.
 */
final readonly class TrackerDefinition
{
    /** @param list<string> $scopes */
    public function __construct(
        public string $id,
        public string $provider,
        public string $name,
        public string $purpose,
        public string $description,
        public string $privacyUrl,
        public array $scopes,
        public bool $active,
        public int $revision,
    ) {
        foreach ([$id, $provider] as $identifier) {
            if (!preg_match('/^[a-z][a-z0-9_-]{0,99}$/D', $identifier)) {
                throw new \InvalidArgumentException('Invalid tracker identifier.');
            }
        }
        if (trim($name) === '' || trim($purpose) === '' || trim($description) === '') {
            throw new \InvalidArgumentException('Tracker information must not be empty.');
        }
        if (!filter_var($privacyUrl, FILTER_VALIDATE_URL)
            || strtolower((string) parse_url($privacyUrl, PHP_URL_SCHEME)) !== 'https'
            || parse_url($privacyUrl, PHP_URL_USER) !== null
            || parse_url($privacyUrl, PHP_URL_PASS) !== null) {
            throw new \InvalidArgumentException('Tracker privacy policy requires an HTTPS URL without credentials.');
        }
        if (!(new TrackingPolicy())->validScopes($scopes)) {
            throw new \InvalidArgumentException('Invalid tracker scopes.');
        }
        if ($revision < 1) {
            throw new \InvalidArgumentException('Tracker revision must be positive.');
        }
    }
}
