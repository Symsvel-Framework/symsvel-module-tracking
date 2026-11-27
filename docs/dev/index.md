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

`Catalog/TrackerDefinition` porte les métadonnées validées : identifiant stable, fournisseur, nom, finalité, description, URL HTTPS de confidentialité sans identifiants, scopes App/Front, état et révision positive. Les données de configuration technique sont séparées et validées par le registre des fournisseurs autorisés. `TrackerCatalog` refuse les doublons, filtre de manière déterministe les entrées actives du scope et vérifie la révision courante. Le BO ne peut jamais être un scope de chargement ; les scopes inconnus ne renvoient rien. Une révision ancienne, une entrée inactive ou hors scope n'autorise aucun chargement. Ces classes ne constituent pas une API publique, ne prouvent pas le consentement et ne réalisent aucune requête réseau. La persistance, l'incrément de révision lors de la modification, les traductions, le chargement des scripts et le raccordement GDPR restent à implémenter.

## Fournisseurs et identifiants techniques (27/11/2026)

`Provider/TrackerProviderRegistry` collecte les services tagués `symsvel.tracking.provider`. Le module fournit les validateurs natifs `google-analytics` (identifiant GA4 préfixé G-) et `meta-pixel` (identifiant décimal non nul). `Catalog/TrackerConfiguration` associe la définition d'un traceur à son identifiant normalisé par le fournisseur déclaré ; un fournisseur inconnu, une déclaration dupliquée ou un identifiant invalide est refusé. Le BO ne doit jamais accepter de snippet JavaScript. Ces validations syntaxiques ne confirment pas l'existence d'un compte externe ni son propriétaire. Un adaptateur supplémentaire doit être développé dans le code et enregistré explicitement comme service Symfony ; son intégration front devra également être prévue et testée. GTM est volontairement absent du registre tant que le contrôle des tags internes et de leurs consentements n'est pas garanti. Aucun script n'est exécuté par ces classes. La persistance et l'API devront utiliser la configuration validée avant publication ; les tests de consentement et de chargement restent requis.
