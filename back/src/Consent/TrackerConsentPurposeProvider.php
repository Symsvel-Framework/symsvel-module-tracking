<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Consent;

use SymSvel\Module\Gdpr\Consent\ConsentPurpose;
use SymSvel\Module\Gdpr\Consent\ConsentPurposeProvider;
use SymSvel\Module\Tracking\Catalog\TrackerRepository;

final readonly class TrackerConsentPurposeProvider implements ConsentPurposeProvider
{
    public function __construct(private TrackerRepository $repository)
    {
    }

    public function purposes(string $scope): iterable
    {
        if (!in_array($scope, ['app', 'front'], true)) {
            return;
        }
        foreach ($this->repository->all() as $configuration) {
            $definition = $configuration->definition;
            if (!$definition->active || !in_array($scope, $definition->scopes, true)) {
                continue;
            }
            yield new ConsentPurpose($definition->id, $definition->revision, $definition->name,
                $definition->purpose, $definition->description, $definition->privacyUrl);
        }
    }
}
