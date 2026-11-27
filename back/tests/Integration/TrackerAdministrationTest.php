<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Tests\Integration;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Schema\Schema;
use DoctrineMigrations\Version20261127120001;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use SymSvel\Module\Acls\Access\BoAccessDecision;
use SymSvel\Module\Acls\Access\BoAccessGate;
use SymSvel\Module\Tracking\Catalog\TrackerAdministration;
use SymSvel\Module\Tracking\Catalog\TrackerRepository;
use SymSvel\Module\Tracking\Controller\BoTrackingController;
use SymSvel\Module\Tracking\Provider\GoogleAnalyticsProvider;
use SymSvel\Module\Tracking\Provider\MetaPixelProvider;
use SymSvel\Module\Tracking\Provider\TrackerProviderRegistry;

final class TrackerAdministrationTest extends TestCase
{
    private Connection $db;
    private TrackerRepository $repository;
    private TrackerAdministration $administration;
    private TrackerProviderRegistry $providers;

    protected function setUp(): void
    {
        self::assertTrue(extension_loaded('pdo_sqlite'), 'Tracking CI requires pdo_sqlite.');
        $this->db = DriverManager::getConnection(['driver' => 'pdo_sqlite', 'memory' => true]);
        require_once dirname(__DIR__, 3).'/Migration/Version20261127120001.php';
        $migration = (new \ReflectionClass(Version20261127120001::class))->newInstanceWithoutConstructor();
        $schema = new Schema();
        $migration->up($schema);
        foreach ($schema->toSql($this->db->getDatabasePlatform()) as $sql) {
            $this->db->executeStatement($sql);
        }
        $this->providers = new TrackerProviderRegistry([new GoogleAnalyticsProvider(), new MetaPixelProvider()]);
        $this->repository = new TrackerRepository($this->db, $this->providers);
        $this->administration = new TrackerAdministration($this->repository, $this->providers);
    }

    protected function tearDown(): void
    {
        if (isset($this->db)) {
            $this->db->close();
        }
    }

    private function payload(): array
    {
        return [
            'provider' => 'google-analytics', 'identifier' => 'g-abc123',
            'name' => 'Analytics', 'purpose' => 'Audience', 'description' => 'Mesure d’audience',
            'privacy_url' => 'https://example.invalid/privacy', 'scopes' => ['front', 'app'],
        ];
    }

    public function testCreationAndRevisionedUpdatesUseTheRealMigration(): void
    {
        $created = $this->administration->create($this->payload());
        $id = $created->definition->id;
        self::assertMatchesRegularExpression('/^tracker-[a-f0-9]{32}$/D', $id);
        self::assertFalse($created->definition->active);
        self::assertSame(1, $created->definition->revision);
        self::assertSame('G-ABC123', $this->repository->find($id)?->identifier);

        $updated = $this->administration->update($id, 1, [...$this->payload(), 'active' => true]);
        self::assertSame(2, $updated->definition->revision);
        self::assertTrue($this->repository->find($id)?->definition->active);
        self::assertSame(['app', 'front'], $this->repository->find($id)?->definition->scopes);

        $inactive = $this->administration->update($id, 2, [...$this->payload(), 'active' => false]);
        self::assertSame(3, $inactive->definition->revision);
        self::assertFalse($this->repository->find($id)?->definition->active);

        try {
            $this->administration->update($id, 1, [...$this->payload(), 'active' => true]);
            self::fail('Stale revision must not be accepted.');
        } catch (\DomainException) {
            self::assertSame(3, $this->repository->find($id)?->definition->revision);
            self::assertFalse($this->repository->find($id)?->definition->active);
        }
        self::assertCount(1, $this->repository->all());
    }

    public function testInvalidScopeAndExecutableFieldsNeverReachDatabase(): void
    {
        foreach ([
            [...$this->payload(), 'scopes' => ['bo']],
            [...$this->payload(), 'identifier' => '<script>alert(1)</script>'],
            [...$this->payload(), 'script' => 'arbitrary code'],
            [...$this->payload(), 'active' => true],
            [...$this->payload(), 'provider' => 'google-tag-manager'],
        ] as $invalid) {
            try {
                $this->administration->create($invalid);
                self::fail('Invalid tracker configuration accepted.');
            } catch (\InvalidArgumentException) {
                self::assertSame([], $this->repository->all());
            }
        }
    }

    private function controller(bool $manage): BoTrackingController
    {
        $gate = new class($manage) implements BoAccessGate {
            public function __construct(private readonly bool $manage) {}
            public function check(Request $request, string $resource, string $action): BoAccessDecision
            {
                return $resource === 'tracking' && ($action === 'list' || ($action === 'manage' && $this->manage))
                    ? new BoAccessDecision(200, 1, 'ROLE_DEV') : new BoAccessDecision(403);
            }
        };
        return new BoTrackingController($gate, $this->repository, $this->administration, $this->providers);
    }

    private function request(string $method, array $payload): Request
    {
        return Request::create('/apibo/tracking', $method, [], [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload, JSON_THROW_ON_ERROR));
    }

    public function testBoAclAndStaleRevisionConflict(): void
    {
        $readOnly = $this->controller(false);
        self::assertSame(403, $readOnly->create($this->request('POST', $this->payload()))->getStatusCode());
        self::assertSame([], $this->repository->all());

        $controller = $this->controller(true);
        $response = $controller->create($this->request('POST', $this->payload()));
        self::assertSame(201, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 8, JSON_THROW_ON_ERROR)['data'];
        $id = $data['id'];
        self::assertFalse($data['active']);
        self::assertSame(403, $readOnly->update($this->request('PUT', [...$this->payload(), 'revision' => 1, 'active' => true]), $id)->getStatusCode());
        $list = $readOnly->list(Request::create('/apibo/tracking'));
        self::assertSame(200, $list->getStatusCode());
        self::assertTrue($list->headers->hasCacheControlDirective('no-store'));
        self::assertFalse(json_decode((string) $list->getContent(), true, 8, JSON_THROW_ON_ERROR)['can_manage']);

        $payload = [...$this->payload(), 'revision' => 1, 'active' => true];
        self::assertSame(200, $controller->update($this->request('PUT', $payload), $id)->getStatusCode());
        self::assertSame(409, $controller->update($this->request('PUT', $payload), $id)->getStatusCode());
        self::assertSame(400, $controller->update($this->request('PUT', [...$payload, 'revision' => 2, 'scopes' => ['bo']]), $id)->getStatusCode());
        self::assertSame(2, $this->repository->find($id)?->definition->revision);
    }
}
