<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Consent;

use SymSvel\Module\Gdpr\Consent\ConsentPolicy;
use SymSvel\Module\Gdpr\Consent\ConsentRepository;
use SymSvel\Module\Tracking\Catalog\TrackerRepository;

/** Internal projection of configurations with a current explicit consent. */
final readonly class AuthorizedTrackers
{
    public function __construct(
        private TrackerRepository $trackers,
        private ConsentRepository $consents,
        private ConsentPolicy $consentPolicy,
        private TrackingPolicy $trackingPolicy,
    ) {
    }

    /** @return list<array{subject: string, revision: int, provider: string, identifier: string}> */
    public function forVisitor(string $scope, ?string $visitorToken, bool $gdprEnabled, \DateTimeImmutable $now, ?string $expectedVersion = null): array
    {
        if (!$gdprEnabled || $visitorToken === null || !in_array($scope, ['app', 'front'], true)) {
            return [];
        }
        $snapshot = $this->consents->find($visitorToken, $scope);
        if ($snapshot === null || ($expectedVersion !== null && $snapshot->version !== $expectedVersion)) {
            return [];
        }
        $result = [];
        foreach ($this->trackers->all() as $configuration) {
            $d = $configuration->definition;
            $consented = $this->consentPolicy->permits($gdprEnabled, $scope, $d->id, $d->revision,
                $now, $snapshot->decision($d->id));
            if ($this->trackingPolicy->canLoad($scope, $d->scopes, true, $gdprEnabled, $consented, $d->active)) {
                $result[] = ['subject' => $d->id, 'revision' => $d->revision,
                    'provider' => $d->provider, 'identifier' => $configuration->identifier];
            }
        }

        return $result;
    }
}
