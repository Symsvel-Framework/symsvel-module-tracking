<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Argument\TaggedIteratorArgument;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use SymSvel\Module\Tracking\Catalog\TrackerConfiguration;
use SymSvel\Module\Tracking\Catalog\TrackerDefinition;
use SymSvel\Module\Tracking\Provider\GoogleAnalyticsProvider;
use SymSvel\Module\Tracking\Provider\MetaPixelProvider;
use SymSvel\Module\Tracking\Provider\TrackerProviderRegistry;
use SymSvel\Module\Tracking\TrackingBundle;

final class TrackerProviderRegistryTest extends TestCase
{
    private function registry(): TrackerProviderRegistry
    {
        return new TrackerProviderRegistry([new MetaPixelProvider(), new GoogleAnalyticsProvider()]);
    }

    public function testOnlyKnownProvidersAreExposedAndIdentifiersAreNormalized(): void
    {
        $registry = $this->registry();
        self::assertSame(['google-analytics' => 'Google Analytics 4', 'meta-pixel' => 'Meta Pixel'], $registry->choices());
        self::assertSame('G-ABC123XYZ9', $registry->normalizeIdentifier('google-analytics', ' g-abc123xyz9 '));
        self::assertSame('123456789012345', $registry->normalizeIdentifier('meta-pixel', ' 123456789012345 '));
    }

    public function testExecutableSnippetCannotBeAProviderIdentifier(): void
    {
        foreach (['google-analytics', 'meta-pixel'] as $provider) {
            try {
                $this->registry()->normalizeIdentifier($provider, '<script>alert(1)</script>');
                self::fail('Executable snippets must not be accepted.');
            } catch (\InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    public function testTagManagerIsNotAvailableBeforeContainerConsentIsControlled(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->registry()->normalizeIdentifier('google-tag-manager', 'GTM-ABC123');
    }

    public function testProviderDuplicatesAreRejected(): void
    {
        $this->expectException(\LogicException::class);
        new TrackerProviderRegistry([new GoogleAnalyticsProvider(), new GoogleAnalyticsProvider()]);
    }

    public function testConfigurationUsesTheDeclaredProviderValidator(): void
    {
        $definition = new TrackerDefinition('analytics', 'google-analytics', 'Analytics', 'Audience', 'Audience measurement',
            'https://example.invalid/privacy', ['front'], true, 1);
        $configuration = new TrackerConfiguration($definition, 'g-abc123xyz9', $this->registry());
        self::assertSame('G-ABC123XYZ9', $configuration->identifier);

        $this->expectException(\InvalidArgumentException::class);
        new TrackerConfiguration($definition, '123456789', $this->registry());
    }

    public function testSymfonyBundleRegistersProviderServices(): void
    {
        $builder = new ContainerBuilder();
        $configurator = (new \ReflectionClass(ContainerConfigurator::class))->newInstanceWithoutConstructor();
        (new TrackingBundle())->loadExtension([], $configurator, $builder);
        self::assertTrue($builder->getDefinition(GoogleAnalyticsProvider::class)->hasTag('symsvel.tracking.provider'));
        self::assertTrue($builder->getDefinition(MetaPixelProvider::class)->hasTag('symsvel.tracking.provider'));
        $argument = $builder->getDefinition(TrackerProviderRegistry::class)->getArgument(0);
        self::assertInstanceOf(TaggedIteratorArgument::class, $argument);
        self::assertSame('symsvel.tracking.provider', $argument->getTag());
    }
}
