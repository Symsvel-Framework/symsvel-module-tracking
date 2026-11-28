<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use SymSvel\Module\Acls\Access\BoAccessGate;
use SymSvel\Module\Tracking\Catalog\TrackerAdministration;
use SymSvel\Module\Tracking\Catalog\TrackerConfiguration;
use SymSvel\Module\Tracking\Catalog\TrackerRepository;
use SymSvel\Module\Tracking\Provider\TrackerProviderRegistry;

final readonly class BoTrackingController
{
    public function __construct(
        private BoAccessGate $access,
        private TrackerRepository $repository,
        private TrackerAdministration $administration,
        private TrackerProviderRegistry $providers,
    ) {
    }

    #[Route('/apibo/tracking', name: 'symsvel_tracking_bo_list', methods: ['GET'], format: 'json')]
    public function list(Request $request): JsonResponse
    {
        $decision = $this->access->check($request, 'tracking', 'list');
        if (!$decision->allowed()) {
            return self::failure($decision->status, 'access_denied');
        }

        return self::reply([
            'data' => array_map(self::present(...), $this->repository->all()),
            'providers' => $this->providers->choices(),
            'can_manage' => $this->access->check($request, 'tracking', 'manage')->allowed(),
        ]);
    }

    #[Route('/apibo/tracking', name: 'symsvel_tracking_bo_create', methods: ['POST'], format: 'json')]
    public function create(Request $request): JsonResponse
    {
        $decision = $this->access->check($request, 'tracking', 'manage');
        if (!$decision->allowed()) {
            return self::failure($decision->status, 'access_denied');
        }
        try {
            return self::reply(['data' => self::present($this->administration->create(self::input($request)))], 201);
        } catch (\InvalidArgumentException|\JsonException) {
            return self::failure(400, 'invalid_tracker');
        }
    }

    #[Route('/apibo/tracking/{id<tracker-[a-f0-9]{32}>}', name: 'symsvel_tracking_bo_update', methods: ['PUT'], format: 'json')]
    public function update(Request $request, string $id): JsonResponse
    {
        $decision = $this->access->check($request, 'tracking', 'manage');
        if (!$decision->allowed()) {
            return self::failure($decision->status, 'access_denied');
        }
        try {
            $input = self::input($request);
            $revision = $input['revision'] ?? null;
            if (!is_int($revision)) {
                throw new \InvalidArgumentException('Expected revision required.');
            }
            unset($input['revision']);

            return self::reply(['data' => self::present($this->administration->update($id, $revision, $input))]);
        } catch (\InvalidArgumentException|\JsonException) {
            return self::failure(400, 'invalid_tracker');
        } catch (\DomainException) {
            return self::failure(409, 'tracker_revision_conflict');
        }
    }

    private static function input(Request $request): array
    {
        if (!str_starts_with(strtolower($request->headers->get('Content-Type', '')), 'application/json')
            || strlen($request->getContent()) > 20000) {
            throw new \InvalidArgumentException('Invalid request body.');
        }
        $data = json_decode($request->getContent(), true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($data) || array_is_list($data)) {
            throw new \InvalidArgumentException('Expected an object.');
        }

        return $data;
    }

    private static function present(TrackerConfiguration $configuration): array
    {
        $d = $configuration->definition;
        return [
            'id' => $d->id, 'provider' => $d->provider, 'identifier' => $configuration->identifier,
            'name' => $d->name, 'purpose' => $d->purpose, 'description' => $d->description,
            'privacy_url' => $d->privacyUrl, 'scopes' => $d->scopes, 'active' => $d->active,
            'revision' => $d->revision,
        ];
    }

    private static function failure(int $status, string $code): JsonResponse
    {
        return self::reply(['error' => ['code' => $code]], $status);
    }

    private static function reply(array $data, int $status = 200): JsonResponse
    {
        $response = new JsonResponse($data, $status);
        $response->headers->set('Cache-Control', 'no-store');

        return $response;
    }
}
