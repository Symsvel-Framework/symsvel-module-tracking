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
