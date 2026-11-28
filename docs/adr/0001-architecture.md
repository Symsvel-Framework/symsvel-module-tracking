# ADR 0001 : catalogue de traceurs et chargement conditionnel

Statut : proposé, chantier ouvert (27/11/2026). Ce document décrit la cible, pas des traceurs déjà intégrés.

## Responsabilités
Tracking est un module natif facultatif proposé, dépendant de GDPR pour les décisions de consentement. Back détient le catalogue et ses API, BO configure le catalogue via ACLs, App et Front chargent seulement les intégrations autorisées. Le BO n'exécute JAMAIS de traceur tiers ; cette interdiction n'est pas une option Settings. Aucun nouveau système de plugins, aucun métier dans Back/Core. Utiliser les contrats SymSvel de manifeste, de scopes facultatifs, d'ACLs, de Settings, de Languages, de migrations et de documentation.

## Catalogue
Chaque entrée a un identifiant stable, un fournisseur connu, un identifiant technique validé, un nom, une finalité et une description traduisibles, une politique de confidentialité, un état actif, et une sélection Front et/ou App. Les scopes sont validés côté serveur ; BO et scopes inconnus interdits. Une configuration sans scope actif est refusée. Les choix de consentement portent sur les finalités et configurations identifiables ; une modification substantielle invalide la décision précédente. Aucune donnée secrète n'est publiée dans le catalogue public. Les paramètres internes, droits d'administration et journal ne sont pas exposés.

Privilégier des adaptateurs versionnés dans le code (Google Analytics, Meta Pixel, Matomo, etc., liste initiale à valider) avec identifiants typés ; jamais un champ JavaScript arbitraire depuis le BO. Un développeur peut ajouter un adaptateur selon le futur contrat documenté. Les tags d'un conteneur GTM sont une difficulté particulière : ne pas activer GTM tant que le contrôle effectif des tags internes et de leur consentement n'est pas garanti. L'autorisation du conteneur n'est pas une autorisation globale.

## Runtime SvelteKit
App et Front sont statiques ; le catalogue est lu au runtime depuis l'API, sans rebuild pour modifier un identifiant ou activer/désactiver une configuration existante. Intégration aux points d'entrée des deux hôtes à concevoir sans écraser les layouts via la synchronisation Tooling. La configuration du scope vient du composant hôte, jamais d'une valeur client utilisée pour contourner les règles. L'API publique renvoie uniquement les entrées actives autorisées pour le scope ; elle ne constitue pas une permission de chargement sans consentement.

GDPR pilote le bandeau (accepter/refuser de visibilité équivalente, choix détaillés, retrait accessible) et le document de confidentialité. Aucun script, iframe, pixel, preconnect ou requête facultative avant autorisation. En cas d'API indisponible, catalogue obsolète, GDPR désactivé, consentement absent/expiré/retiré ou configuration inconnue, ne rien charger. Le retrait nécessite arrêt réel des SDK, suppression des cookies accessibles concernés et si nécessaire rechargement de la page ; retirer seulement la balise script n'est pas suffisant. Tenir compte des navigations SvelteKit et de la CSP de déploiement. Aucun élargissement automatique de CSP, aucun suivi côté BO, aucune transmission de données utilisateur par défaut.

La première brique TrackingPolicy fournit un contrôle pur et défensif : scope App/Front, scopes configurés valides, activation des deux modules et consentement courant. Elle ne réalise aucun chargement réseau et ne remplace ni validation du catalogue ni preuve de consentement.

## Validation avant publication
- Définir dépendance GDPR et contrat partagé sans cycle, ACLs du BO, persistance portable, API publique minimale et intégration des hôtes.
- Tests de validation des fournisseurs/scopes, refus BO côté serveur et client, défaut fermé, absence de requêtes avant consentement, retrait et modification de configuration.
- Tests navigateur avec requêtes réseau contrôlées, sans solliciter les vrais services tiers en CI.
- CI, CT XT sur les quatre SGBD, installations BO seules et avec interfaces facultatives, documentation dev/admin/user, revue du mainteneur. Pas d'intégration automatique au Setup ou de release fonctionnelle avant validation.

## Première persistance (27/11/2026)

La table du catalogue est détenue par Tracking. Création inactive, identifiant aléatoire non recyclé, révision positive ; toute modification incrémente la révision par comparaison atomique de la révision attendue. Le retrait fonctionnel désactive l'entrée au lieu de supprimer son identité. La première API est réservée au BO, protégée par les ACL list/manage ; elle ne publie aucun catalogue public avant raccordement au consentement GDPR. Les migrations restent au format Schema existant et les tests d'intégration exercent SQLite. Les trois autres SGBD et le parcours Flex/Tooling devront être validés dans XT.

## Contrat GDPR

Le catalogue Tracking expose ses finalités au provider natif GDPR, qui détient les décisions. AuthorizedTrackers constitue une projection interne par jeton, scope et révision ; aucune donnée de chargement n'est retournée sans décision positive courante. L'installation du module permet la configuration ; chaque traceur est désactivable. Aucun endpoint public ou loader n'est encore activé. Dépendance de branche provisoire avant intégration dev et versionnement stable.

## Projection de chargement

Le serveur ne publie les paramètres techniques des traceurs que via POST /apiopen/tracking/{app|front}/authorized, avec origine mappée, jeton GDPR signé et version de sélection courante et complète. La réponse ne contient que les grants actifs et versionnés du scope. Une erreur ou un conflit bloque le chargement. Les tests exercent le retrait, les origines, la désactivation GDPR et les changements de révision. Le client reste responsable de la revalidation et de l'arrêt des SDK ; aucune prétention à un arrêt distant instantané. Aucun chargement n'est encore activé.

## Client de projection

Le client App/Front n'appelle le Back qu'avec un ConsentPermit courant. La version et l'expiration retournées doivent être identiques, les configurations connues et valides. Les doublons et fournisseurs sans adaptateur sont refusés. Une annulation de requête ou une expiration invalide la réponse ; les erreurs ne permettent pas de réutiliser une autorisation antérieure. Aucun SDK n'est encore chargé, le futur orchestrateur doit invalider le signal à chaque changement et arrêter effectivement les fournisseurs déjà actifs.

## Orchestration du cycle de vie

Un runtime par interface App/Front réconcilie les configurations autorisées avec les adaptateurs natifs. Un changement de permit invalide les requêtes et arrête synchroniquement tous les handles ; une revalidation identique ne duplique pas les SDK. En cas de réponse obsolète, d'adaptateur absent ou d'erreur, aucune nouvelle activation ; les handles sont arrêtés. Un échec d'arrêt interdit toute réactivation de l'instance et signale la nécessité d'un reset sûr du document. Les tests simulent les SDK ; leur comportement réseau réel et l'intégration hôte restent à valider. Aucun SDK tiers n'est ajouté dans cette étape.

Premier adaptateur GA4 : chargement gtag.js unique après autorisation, destinations explicitement configurées, arrêt par ga-disable-ID, pageviews dirigés par send_to avec route publique. Ne pas écraser les intégrations Google existantes. Les mesures améliorées et destinations liées doivent être configurées côté fournisseur ; le module ne garantit pas leur désactivation distante. Le montage et le contrôle réseau réel, le nettoyage des cookies et le reset sûr restent requis avant publication.

Meta Pixel : consentement global, trackSingle par ID, aucun matching avancé ni CAPI explicites, autoConfig et suivi historique désactivés. Tout retrait invalide le document Meta, même si un autre ID reste autorisé. Le runtime devra coordonner un reset après persistance du choix ; ne pas réaccorder de consentement global dans le document courant. Le SDK ne doit pas être monté avant contrôle des routes/URL sensibles, nettoyage des cookies et tests réseau. Aucune garantie d'arrêt ou de confidentialité fondée uniquement sur le retrait de la balise script.

## Garde de navigation publique

Proposition conservatrice : les SDK ne sont admissibles que sur des routes statiques publiques explicitement auditées, sans paramètres d'URL, Front `/` par défaut, App aucune par défaut. Les routes sensibles natives sont refusées. Une navigation vers une route non admissible après chargement impose de quitter le document, pas seulement de supprimer le script. Cette limite est motivée par les privilèges DOM des SDK tiers ; elle reste à valider avec le mainteneur avant publication.
