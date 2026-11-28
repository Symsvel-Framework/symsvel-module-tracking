<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Catalog;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use SymSvel\Module\Tracking\Provider\TrackerProviderRegistry;

/** Module-owned persistence. All changes invalidate previous consent revisions. */
final readonly class TrackerRepository
{
    public function __construct(private Connection $db, private TrackerProviderRegistry $providers)
    {
    }

    /** @return list<TrackerConfiguration> */
    public function all(): array
    {
        return array_map($this->hydrate(...), $this->db->fetchAllAssociative(
            'SELECT * FROM symsvel_tracking_catalog ORDER BY id',
        ));
    }

    public function find(string $id): ?TrackerConfiguration
    {
        $row = $this->db->fetchAssociative('SELECT * FROM symsvel_tracking_catalog WHERE id = ?', [$id]);

        return $row === false ? null : $this->hydrate($row);
    }

    /** Creation starts active in the validated catalogue. The ID is never recycled. */
    public function create(TrackerConfiguration $configuration): void
    {
        if (!$configuration->definition->active || $configuration->definition->revision !== 1) {
            throw new \InvalidArgumentException('A new tracker must be active at revision 1.');
        }

        $values = ['id' => $configuration->definition->id, ...$this->values($configuration)];
        $this->db->insert('symsvel_tracking_catalog', $values, $this->types());
    }

    /** Compare-and-swap prevents stale edits from restoring a consent revision. */
    public function update(TrackerConfiguration $configuration, int $expectedRevision): void
    {
        $id = $configuration->definition->id;
        if ($expectedRevision < 1 || $expectedRevision >= 2147483647
            || $configuration->definition->revision !== $expectedRevision + 1) {
            throw new \InvalidArgumentException('Invalid tracker revision transition.');
        }
        $affected = $this->db->update('symsvel_tracking_catalog', $this->values($configuration),
            ['id' => $id, 'revision' => $expectedRevision], $this->types());

        if ($affected !== 1) {
            throw new \DomainException('Tracker configuration has changed or is missing.');
        }
    }

    private function values(TrackerConfiguration $configuration): array
    {
        $definition = $configuration->definition;
        return [
            'provider' => $definition->provider,
            'provider_identifier' => $configuration->identifier,
            'name' => $definition->name,
            'purpose' => $definition->purpose,
            'description' => $definition->description,
            'privacy_url' => $definition->privacyUrl,
            'scope_app' => in_array('app', $definition->scopes, true),
            'scope_front' => in_array('front', $definition->scopes, true),
            'active' => $definition->active,
            'revision' => $definition->revision,
        ];
    }

    private function types(): array
    {
        return [
            'scope_app' => ParameterType::BOOLEAN,
            'scope_front' => ParameterType::BOOLEAN,
            'active' => ParameterType::BOOLEAN,
            'revision' => ParameterType::INTEGER,
        ];
    }

    private function hydrate(array $row): TrackerConfiguration
    {
        $scopes = [];
        foreach (['app', 'front'] as $scope) {
            if (self::boolean($row['scope_'.$scope])) {
                $scopes[] = $scope;
            }
        }
        return new TrackerConfiguration(new TrackerDefinition(
            (string) $row['id'], (string) $row['provider'], (string) $row['name'],
            (string) $row['purpose'], (string) $row['description'], (string) $row['privacy_url'],
            $scopes, self::boolean($row['active']), (int) $row['revision'],
        ), (string) $row['provider_identifier'], $this->providers);
    }

    private static function boolean(mixed $value): bool
    {
        return match ($value) {
            true, 1, '1', 't', 'true', 'TRUE' => true,
            false, 0, '0', 'f', 'false', 'FALSE' => false,
            default => throw new \UnexpectedValueException('Invalid stored tracker flag.'),
        };
    }
}
