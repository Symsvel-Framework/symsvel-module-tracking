<?php

declare(strict_types=1);

namespace SymSvel\Module\Tracking\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use SymSvel\Module\Gdpr\Consent\BrowserConsentToken;
use SymSvel\Module\Gdpr\Consent\ConsentSelection;
use SymSvel\Module\Gdpr\Consent\TrustedConsentOrigin;
use SymSvel\Module\Gdpr\Settings\GdprConfiguration;
use SymSvel\Module\Tracking\Consent\AuthorizedTrackers;

final readonly class AuthorizedTrackersController
{
    public function __construct(
        private AuthorizedTrackers $trackers,
        private ConsentSelection $selection,
        private BrowserConsentToken $tokens,
        private TrustedConsentOrigin $origins,
        private GdprConfiguration $configuration,
    ) {
    }

    #[Route('/apiopen/tracking/{scope<app|front>}/authorized', name: 'symsvel_tracking_authorized', methods: ['POST'], format: 'json')]
    public function authorized(Request $request, string $scope): JsonResponse
    {
        $origin = $request->headers->get('Origin');
        if (!$this->origins->allows($scope, $origin)
            || (!$request->isSecure() && !str_starts_with((string) $origin, 'http://'))) {
            return self::failure('consent_origin_denied', 403);
        }
        if (!preg_match('/^Bearer ([a-f0-9]{64}\.[a-f0-9]{64})$/D', $request->headers->get('Authorization', ''), $parts)) {
            return self::failure('invalid_consent_credential', 401);
        }
        try {
            $visitor = $this->tokens->verify($scope, $parts[1]);
        } catch (\InvalidArgumentException) {
            return self::failure('invalid_consent_credential', 401);
        }
        if (!preg_match('~^application/json(?:\s*;|$)~i', $request->headers->get('Content-Type', ''))
            || strlen($request->getContent()) > 1024) {
            return self::failure('invalid_consent_version', 400);
        }
        try {
            $body = json_decode($request->getContent(), true, 4, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return self::failure('invalid_consent_version', 400);
        }
        if (!is_array($body) || array_keys($body) !== ['version']
            || !is_string($body['version']) || !preg_match('/^[a-f0-9]{32}$/D', $body['version'])) {
            return self::failure('invalid_consent_version', 400);
        }

        try {
            if (!$this->configuration->enabled()) {
                return self::failure('consent_disabled', 409);
            }
            $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
            $state = $this->selection->state($scope, $visitor, true, $now);
            if (!$state['complete'] || $state['version'] !== $body['version']) {
                return self::failure('consent_conflict', 409);
            }
            $entries = $this->trackers->forVisitor($scope, $visitor, true, $now, $body['version']);

            return self::reply(['data' => ['version' => $body['version'], 'expires_at' => $state['expires_at'], 'trackers' => $entries]]);
        } catch (\Exception) {
            return self::failure('tracking_unavailable', 503);
        }
    }

    private static function failure(string $code, int $status): JsonResponse
    {
        return self::reply(['error' => ['code' => $code]], $status);
    }

    private static function reply(array $payload, int $status = 200): JsonResponse
    {
        $response = new JsonResponse($payload, $status);
        $response->headers->set('Cache-Control', 'no-store');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
}
