<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Provider;

final class GoogleAnalyticsProvider implements TrackerProvider
{
    public function id(): string { return 'google-analytics'; }
    public function label(): string { return 'Google Analytics 4'; }

    public function normalizeIdentifier(string $identifier): string
    {
        $identifier = strtoupper(trim($identifier));
        if (!preg_match('/^G-[A-Z0-9]{1,64}$/D', $identifier)) {
            throw new \InvalidArgumentException('A GA4 measurement identifier is required.');
        }

        return $identifier;
    }
}
