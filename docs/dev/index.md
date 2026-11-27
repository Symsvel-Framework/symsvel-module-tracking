# Tracking

Documentation développeur.

## Traductions Svelte

Pour chaque scope Svelte du module (bo, app, front), placer les dictionnaires dans `<scope>/src/lib/translations/<lang>.ts` uniquement si des libellés sont nécessaires. Format obligatoire : `export default {"title":"Texte"} as const;` (objet JSON strict, pas de code TypeScript exécuté par Tooling). Clé publique : `<scope>.tracking.<key>`. Tooling déploie les fichiers sous `<scope>/src/lib/translations/tracking/<lang>.ts`, puis Languages persiste les clés après migrations. Le dossier initial est vide ; ne pas inventer de clés.
