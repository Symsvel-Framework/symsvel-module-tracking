<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Catalog;

use SymSvel\Module\Tracking\Provider\TrackerProviderRegistry;

/** Administration operations accept metadata and provider IDs, never code. */
final readonly class TrackerAdministration
{
    public function __construct(private TrackerRepository $repository, private TrackerProviderRegistry $providers)
    {
    }

    public function create(array $input): TrackerConfiguration
    {
        $configuration = $this->configuration('tracker-'.bin2hex(random_bytes(16)), 1, $input, true);
        $this->repository->create($configuration);

        return $configuration;
    }

    public function update(string $id, int $expectedRevision, array $input): TrackerConfiguration
    {
        if ($expectedRevision < 1 || $expectedRevision >= 2147483647) {
            throw new \InvalidArgumentException('Invalid tracker revision.');
        }
        $configuration = $this->configuration($id, $expectedRevision + 1, $input, null);
        $this->repository->update($configuration, $expectedRevision);

        return $configuration;
    }

    private function configuration(string $id, int $revision, array $input, ?bool $forcedActive): TrackerConfiguration
    {
        $keys = ['provider', 'identifier', 'name', 'purpose', 'description', 'privacy_url', 'scopes'];
        if ($forcedActive === null) {
            $keys[] = 'active';
        }
        if (array_diff($keys, array_keys($input)) !== [] || array_diff(array_keys($input), $keys) !== []) {
            throw new \InvalidArgumentException('Invalid tracker fields.');
        }
        foreach (['provider' => 100, 'identifier' => 255, 'name' => 150, 'purpose' => 150, 'description' => 10000, 'privacy_url' => 2048] as $key => $limit) {
            if (!is_string($input[$key]) || strlen($input[$key]) > $limit) {
                throw new \InvalidArgumentException('Invalid tracker field: '.$key);
            }
        }
        if (!is_array($input['scopes']) || ($forcedActive === null && !is_bool($input['active']))) {
            throw new \InvalidArgumentException('Invalid tracker scopes or state.');
        }

        return new TrackerConfiguration(new TrackerDefinition(
            $id, $input['provider'], trim($input['name']), trim($input['purpose']),
            trim($input['description']), trim($input['privacy_url']), $input['scopes'],
            $forcedActive ?? $input['active'], $revision,
        ), $input['identifier'], $this->providers);
    }
}
