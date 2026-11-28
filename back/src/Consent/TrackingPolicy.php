<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Consent;

/**
 * A defensive decision, not a script loader or a consent store.
 * The caller must verify the catalogue version and GDPR's current decision.
 */
final class TrackingPolicy
{
    public function validScopes(array $scopes): bool
    {
        if ($scopes === [] || !array_is_list($scopes)) {
            return false;
        }

        $seen = [];
        foreach ($scopes as $scope) {
            if (!in_array($scope, ['app', 'front'], true) || isset($seen[$scope])) {
                return false;
            }
            $seen[$scope] = true;
        }

        return true;
    }

    public function canLoad(
        string $scope,
        array $configuredScopes,
        bool $trackingEnabled,
        bool $gdprEnabled,
        bool $currentConsent,
        bool $trackerActive,
    ): bool {
        return $trackingEnabled
            && $gdprEnabled
            && $currentConsent
            && $trackerActive
            && $this->validScopes($configuredScopes)
            && in_array($scope, $configuredScopes, true);
    }
}
