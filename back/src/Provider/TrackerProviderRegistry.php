<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Provider;

/** Only explicitly registered, code-owned providers can be configured. */
final readonly class TrackerProviderRegistry
{
    /** @var array<string, TrackerProvider> */
    private array $providers;

    /** @param iterable<TrackerProvider> $providers */
    public function __construct(iterable $providers)
    {
        $indexed = [];
        foreach ($providers as $provider) {
            if (!$provider instanceof TrackerProvider) {
                throw new \InvalidArgumentException('Invalid tracker provider.');
            }
            $id = $provider->id();
            if (!preg_match('/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/D', $id)
                || trim($provider->label()) === '') {
                throw new \InvalidArgumentException('Invalid tracker provider metadata.');
            }
            if (isset($indexed[$id])) {
                throw new \LogicException('Duplicate tracker provider: '.$id);
            }
            $indexed[$id] = $provider;
        }
        ksort($indexed, SORT_STRING);
        $this->providers = $indexed;
    }

    /** @return array<string, string> */
    public function choices(): array
    {
        return array_map(static fn (TrackerProvider $provider): string => $provider->label(), $this->providers);
    }

    public function normalizeIdentifier(string $provider, string $identifier): string
    {
        $adapter = $this->providers[$provider] ?? null;
        if ($adapter === null) {
            throw new \InvalidArgumentException('Unknown or unsupported tracker provider.');
        }

        return $adapter->normalizeIdentifier($identifier);
    }
}
