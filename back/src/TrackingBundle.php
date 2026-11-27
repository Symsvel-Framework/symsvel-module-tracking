<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking;

use Symfony\Component\DependencyInjection\Argument\TaggedIteratorArgument;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;
use SymSvel\Module\Tracking\Consent\TrackingPolicy;
use SymSvel\Module\Tracking\Provider\GoogleAnalyticsProvider;
use SymSvel\Module\Tracking\Provider\MetaPixelProvider;
use SymSvel\Module\Tracking\Provider\TrackerProviderRegistry;

final class TrackingBundle extends AbstractBundle
{
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $builder->register(TrackingPolicy::class);
        foreach ([GoogleAnalyticsProvider::class, MetaPixelProvider::class] as $provider) {
            $builder->register($provider)->addTag('symsvel.tracking.provider');
        }
        $builder->register(TrackerProviderRegistry::class)
            ->setArgument(0, new TaggedIteratorArgument('symsvel.tracking.provider'));
    }
}
