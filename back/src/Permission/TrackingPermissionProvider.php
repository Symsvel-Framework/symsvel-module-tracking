<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Permission;

use SymSvel\Module\Acls\Permission\PermissionDefinition;
use SymSvel\Module\Acls\Permission\PermissionProviderInterface;

final class TrackingPermissionProvider implements PermissionProviderInterface
{
    public function permissions(): iterable
    {
        yield new PermissionDefinition('tracking', 'list', 'Consulter le catalogue des traceurs');
        yield new PermissionDefinition('tracking', 'manage', 'Configurer les traceurs');
    }
}
