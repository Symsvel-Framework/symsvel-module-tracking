# Tracking

Documentation développeur.

## Traductions Svelte

Pour chaque scope Svelte du module (bo, app, front), placer les dictionnaires dans `<scope>/src/lib/translations/<lang>.ts` uniquement si des libellés sont nécessaires. Format obligatoire : `export default {"title":"Texte"} as const;` (objet JSON strict, pas de code TypeScript exécuté par Tooling). Clé publique : `<scope>.tracking.<key>`. Tooling déploie les fichiers sous `<scope>/src/lib/translations/tracking/<lang>.ts`, puis Languages persiste les clés après migrations. Le dossier initial est vide ; ne pas inventer de clés.

## État du chantier (27/11/2026)

Catalogue de traceurs tiers et chargement conditionnel dans App/Front, jamais dans BO.

Voir [ADR 0001](../adr/0001-architecture.md) pour le périmètre cible et les décisions à valider.

`Consent/TrackingPolicy` refuse toute portée non App/Front, un catalogue de scopes invalide, un module désactivé ou une autorisation absente. Les tests couvrent ces refus. Aucun chargement de script, API ou stockage de consentement n'est encore raccordé.

Validation : composer qa puis CI, intégration et crash-tests XT avant publication fonctionnelle.

## Catalogue interne : première brique

`Catalog/TrackerDefinition` porte les métadonnées validées : identifiant stable, fournisseur, nom, finalité, description, URL HTTPS de confidentialité sans identifiants, scopes App/Front, état et révision positive. Les données de configuration technique sont séparées et validées par le registre des fournisseurs autorisés. `TrackerCatalog` refuse les doublons, filtre de manière déterministe les entrées actives du scope et vérifie la révision courante. Le BO ne peut jamais être un scope de chargement ; les scopes inconnus ne renvoient rien. Une révision ancienne, une entrée inactive ou hors scope n'autorise aucun chargement. Ces classes ne constituent pas une API publique, ne prouvent pas le consentement et ne réalisent aucune requête réseau. Les traductions, le chargement des scripts et le raccordement GDPR restent à implémenter.

## Fournisseurs et identifiants techniques (27/11/2026)

`Provider/TrackerProviderRegistry` collecte les services tagués `symsvel.tracking.provider`. Le module fournit les validateurs natifs `google-analytics` (identifiant GA4 préfixé G-) et `meta-pixel` (identifiant décimal non nul). `Catalog/TrackerConfiguration` associe la définition d'un traceur à son identifiant normalisé par le fournisseur déclaré ; un fournisseur inconnu, une déclaration dupliquée ou un identifiant invalide est refusé. Le BO ne doit jamais accepter de snippet JavaScript. Ces validations syntaxiques ne confirment pas l'existence d'un compte externe ni son propriétaire. Un adaptateur supplémentaire doit être développé dans le code et enregistré explicitement comme service Symfony ; son intégration front devra également être prévue et testée. GTM est volontairement absent du registre tant que le contrôle des tags internes et de leurs consentements n'est pas garanti. Aucun script n'est exécuté par ces classes. La persistance et l'API BO utilisent la configuration validée ; les tests de consentement et de chargement restent requis.

## Persistance et administration BO (27/11/2026)

La migration Schema `Version20261127120001` crée la table `symsvel_tracking_catalog`, déclarée dans module.json. Le dépôt DBAL `TrackerRepository` stocke les métadonnées et l'identifiant technique public validé, avec deux booléens de scope (app/front), un état et une révision. `TrackerAdministration` crée un ID aléatoire non recyclé, désactivé à la révision 1. La mise à jour exige la révision attendue et incrémente systématiquement celle-ci, même pour un changement de libellé ; une édition concurrente est refusée. Il n'existe pas de suppression physique à ce stade : désactiver préserve l'identité et évite la réutilisation d'un ancien consentement. Les écritures utilisent des paramètres DBAL typés, aucun SQL spécifique à un SGBD.

API BO : `GET /apibo/tracking` (ACL tracking:list, catalogue, fournisseurs et can_manage), `POST /apibo/tracking` (tracking:manage, création inactive, HTTP 201), `PUT /apibo/tracking/{id}` (tracking:manage, remplacement des champs et état, révision obligatoire, HTTP 409 en cas de conflit). Les champs de création sont provider, identifier, name, purpose, description, privacy_url, scopes ; la modification ajoute active et revision. Aucune entrée BO dans les scopes, aucun snippet. Les réponses ne sont pas mises en cache. Les tests SQLite utilisent la migration réelle et contrôlent les écritures, les révisions, les ACL et les refus. Le CT sur les quatre SGBD demeure nécessaire. L'interface BO est livrée ; l'API publique, le consentement GDPR et les loaders ne sont pas encore raccordés. Une entrée active en BDD ne provoque donc aucune requête tierce.

## Interface BO (27/11/2026)

Le module déclare navigation.ts (ACL tracking:list et probe GET /apibo/tracking) et la route /tracking. Le tableau réutilise DataTable, recherche, tri et pagination ; le formulaire Modal utilise InputField, Dropdown, Button et Alert du BO, avec choix App/Front seulement. La création transmet les champs éditables sans active ni revision ; la modification et l'activation/désactivation transmettent la révision attendue. Un 409 indique une édition concurrente, sans écraser le catalogue. Dictionnaires FR/EN sous bo/src/lib/translations et surcharge par generatedTranslation. L'interface est statique et ne charge aucun SDK. CI assemble le module dans le BO hôte dev, vérifie TypeScript/lint/build et exécute les tests unitaires de présentation. CT navigateur et intégration GDPR restent requis.

Correctif du contrôle TypeScript de l'assemblage BO : les limites `maxlength` des composants InputField sont transmises comme nombres, conformément au contrat HTMLInputAttributes du composant hôte. Le contrôle svelte-check reste obligatoire.

## Raccordement du catalogue à GDPR

Tracking dépend désormais explicitement de GDPR, sans cycle. Le provider tagué `symsvel.gdpr.consent_purpose_provider` expose uniquement les entrées actives du scope App/Front et leurs métadonnées publiques, jamais leur identifiant technique. Le service interne AuthorizedTrackers relit le catalogue et le dernier choix GDPR et ne projette les identifiants techniques que pour un grant courant, de même scope, sujet et révision. La présence du module constitue ici l'activation globale Tracking ; chaque traceur conserve son état individuel. L'appelant devra fournir l'état GDPR issu de GdprConfiguration et un jeton navigateur authentifié. Aucun endpoint ni loader ne consomme encore ce service. En cas d'erreur le futur adaptateur HTTP doit échouer fermé. Tests intermodules SQLite avec les deux migrations réelles. Composer cible temporairement la branche de la PR GDPR #1 : remplacer par dev-dev après merge puis par une version distribuée compatible avant release. Le CT réseau et multi-SGBD reste requis.

La CI autonome de Tracking déclare temporairement Settings dev-dev dans require-dev : Composer doit autoriser explicitement cette dépendance transitive instable de GDPR au niveau racine. Ne pas assouplir minimum-stability globalement ; supprimer cette contrainte temporaire lors du passage aux releases compatibles.

## Projection publique des traceurs autorisés

POST /apiopen/tracking/{app|front}/authorized exige une origine exacte du scope et HTTPS hors développement local, le jeton Bearer de consentement signé GDPR et un objet JSON {version: string}. Aucune identité compte ni cookie. Le serveur relit les paramètres GDPR et la sélection complète actuelle ; une version obsolète, un catalogue révisé ou un choix expiré renvoie 409, sans identifiant technique. Le service vérifie une seconde fois la version lors de la lecture du snapshot et les révisions de chaque traceur. La réponse no-store contient data.version, data.expires_at et data.trackers (subject, revision, provider, identifier) uniquement pour des grants courants. Refus intégral : tableau vide. 401/403/409/503 ou échec de requête imposent l'arrêt de tout chargement. Le client doit vérifier la version attendue, l'expiration et les changements de catalogue, notamment au retrait et à la reprise de visibilité. Il n'existe pas de garantie d'arrêt instantané dans un autre navigateur ou face à une modification distante entre deux appels ; une revalidation et un arrêt local effectifs restent nécessaires. Tests HTTP directs avec SQLite, Settings réels et migrations Tracking/GDPR. Aucun SDK ni loader encore activé.
