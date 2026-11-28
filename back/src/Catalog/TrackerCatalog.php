<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Catalog;

/** Pure catalogue projection; no network loading and no consent decisions. */
final readonly class TrackerCatalog
{
    /** @var array<string, TrackerDefinition> */
    private array $trackers;

    /** @param iterable<TrackerDefinition> $trackers */
    public function __construct(iterable $trackers)
    {
        $indexed = [];
        foreach ($trackers as $tracker) {
            if (!$tracker instanceof TrackerDefinition) {
                throw new \InvalidArgumentException('Invalid tracker definition.');
            }
            if (isset($indexed[$tracker->id])) {
                throw new \LogicException('Duplicate tracker identifier: '.$tracker->id);
            }
            $indexed[$tracker->id] = $tracker;
        }
        ksort($indexed, SORT_STRING);
        $this->trackers = $indexed;
    }

    /** @return list<TrackerDefinition> */
    public function activeForScope(string $scope): array
    {
        if (!in_array($scope, ['app', 'front'], true)) {
            return [];
        }

        return array_values(array_filter(
            $this->trackers,
            static fn (TrackerDefinition $tracker): bool => $tracker->active && in_array($scope, $tracker->scopes, true),
        ));
    }

    public function hasCurrentRevision(string $scope, string $id, int $revision): bool
    {
        if (!in_array($scope, ['app', 'front'], true)) {
            return false;
        }

        $tracker = $this->trackers[$id] ?? null;

        return $tracker !== null && $tracker->active
            && in_array($scope, $tracker->scopes, true) && $tracker->revision === $revision;
    }
}
