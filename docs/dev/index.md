# Tracking

Documentation développeur.

## Traductions Svelte

Pour chaque scope Svelte du module (bo, app, front), placer les dictionnaires dans `<scope>/src/lib/translations/<lang>.ts` uniquement si des libellés sont nécessaires. Format obligatoire : `export default {"title":"Texte"} as const;` (objet JSON strict, pas de code TypeScript exécuté par Tooling). Clé publique : `<scope>.tracking.<key>`. Tooling déploie les fichiers sous `<scope>/src/lib/translations/tracking/<lang>.ts`, puis Languages persiste les clés après migrations. Le dossier initial est vide ; ne pas inventer de clés.

## État du chantier (27/11/2026)

Catalogue de traceurs tiers et chargement conditionnel dans App/Front, jamais dans BO.

Voir [ADR 0001](../adr/0001-architecture.md) pour le périmètre cible et les décisions à valider.

`Consent/TrackingPolicy` refuse toute portée non App/Front, un catalogue de scopes invalide, un module désactivé ou une autorisation absente. Les tests couvrent ces refus. Aucun adaptateur tiers, chargement de script, API ou stockage de consentement n'est encore raccordé.

Validation : composer qa puis CI, intégration et crash-tests XT avant publication fonctionnelle.
