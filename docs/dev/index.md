# Tracking

Documentation développeur.

## Traductions Svelte

Pour chaque scope Svelte du module (bo, app, front), placer les dictionnaires dans `<scope>/src/lib/translations/<lang>.ts` uniquement si des libellés sont nécessaires. Format obligatoire : `export default {"title":"Texte"} as const;` (objet JSON strict, pas de code TypeScript exécuté par Tooling). Clé publique : `<scope>.tracking.<key>`. Tooling déploie les fichiers sous `<scope>/src/lib/translations/tracking/<lang>.ts`, puis Languages persiste les clés après migrations. Le dossier initial est vide ; ne pas inventer de clés.

## État du chantier (27/11/2026)

Catalogue de traceurs tiers et chargement conditionnel dans App/Front, jamais dans BO.

Voir [ADR 0001](../adr/0001-architecture.md) pour le périmètre cible et les décisions à valider.

`Consent/TrackingPolicy` refuse toute portée non App/Front, un catalogue de scopes invalide, un module désactivé ou une autorisation absente. Les tests couvrent ces refus. Aucun adaptateur tiers, chargement de script, API ou stockage de consentement n'est encore raccordé.

Validation : composer qa puis CI, intégration et crash-tests XT avant publication fonctionnelle.

## Catalogue interne : première brique

`Catalog/TrackerDefinition` porte les métadonnées validées : identifiant stable, fournisseur, nom, finalité, description, URL HTTPS de confidentialité sans identifiants, scopes App/Front, état et révision positive. Les données de configuration technique sont séparées et devront être validées par les adaptateurs autorisés. `TrackerCatalog` refuse les doublons, filtre de manière déterministe les entrées actives du scope et vérifie la révision courante. Le BO ne peut jamais être un scope de chargement ; les scopes inconnus ne renvoient rien. Une révision ancienne, une entrée inactive ou hors scope n'autorise aucun chargement. Ces classes ne constituent pas une API publique, ne prouvent pas le consentement et ne réalisent aucune requête réseau. La persistance, l'incrément de révision lors de la modification, les traductions, les adaptateurs et le raccordement GDPR restent à implémenter.
