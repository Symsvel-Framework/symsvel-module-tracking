<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Provider;

final class MetaPixelProvider implements TrackerProvider
{
    public function id(): string { return 'meta-pixel'; }
    public function label(): string { return 'Meta Pixel'; }

    public function normalizeIdentifier(string $identifier): string
    {
        $identifier = trim($identifier);
        if (!preg_match('/^[1-9][0-9]{0,31}$/D', $identifier)) {
            throw new \InvalidArgumentException('A decimal Meta Pixel identifier is required.');
        }

        return $identifier;
    }
}
