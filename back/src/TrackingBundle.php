<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking;

use Symfony\Component\DependencyInjection\Argument\TaggedIteratorArgument;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;
use SymSvel\Module\Tracking\Consent\TrackingPolicy;
use SymSvel\Module\Tracking\Consent\TrackerConsentPurposeProvider;
use SymSvel\Module\Tracking\Consent\AuthorizedTrackers;
use SymSvel\Module\Tracking\Catalog\TrackerRepository;
use SymSvel\Module\Tracking\Catalog\TrackerAdministration;
use SymSvel\Module\Tracking\Controller\BoTrackingController;
use SymSvel\Module\Tracking\Controller\AuthorizedTrackersController;
use SymSvel\Module\Tracking\Permission\TrackingPermissionProvider;
use SymSvel\Module\Tracking\Provider\GoogleAnalyticsProvider;
use SymSvel\Module\Tracking\Provider\MetaPixelProvider;
use SymSvel\Module\Tracking\Provider\TrackerProviderRegistry;

final class TrackingBundle extends AbstractBundle
{
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $builder->register(TrackingPolicy::class);
        $builder->register(TrackerConsentPurposeProvider::class)->setAutowired(true)->addTag('symsvel.gdpr.consent_purpose_provider');
        $builder->register(AuthorizedTrackers::class)->setAutowired(true);
        $builder->register(TrackerRepository::class)->setAutowired(true);
        $builder->register(TrackerAdministration::class)->setAutowired(true);
        $builder->register(AuthorizedTrackersController::class)->setAutowired(true)->addTag('controller.service_arguments');
        $builder->register(BoTrackingController::class)->setAutowired(true)->addTag('controller.service_arguments');
        $builder->register(TrackingPermissionProvider::class)->addTag('symsvel.acls.permission_provider');
        foreach ([GoogleAnalyticsProvider::class, MetaPixelProvider::class] as $provider) {
            $builder->register($provider)->addTag('symsvel.tracking.provider');
        }
        $builder->register(TrackerProviderRegistry::class)
            ->setArgument(0, new TaggedIteratorArgument('symsvel.tracking.provider'));
    }
}
