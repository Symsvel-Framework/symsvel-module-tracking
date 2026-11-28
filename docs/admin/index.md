# Tracking

Documentation admin.

## Catalogue des traceurs (chantier en cours)

Le catalogue permet de préparer un identifiant Google Analytics 4 ou Meta Pixel, son nom, sa finalité, sa description, sa politique de confidentialité HTTPS et ses scopes App et/ou Front. Le BO n'est jamais un scope de suivi. Une nouvelle entrée est toujours inactive ; une modification (y compris activation ou désactivation) renouvelle sa révision. Les consentements de révisions antérieures ne pourront pas être réutilisés. Les droits `tracking:list` et `tracking:manage` protègent l'API d'administration. GTM reste indisponible tant que le contrôle de ses tags n'est pas garanti. L'écran BO /tracking permet de rechercher, trier, paginer, créer, modifier, activer et désactiver les traceurs. L'ajout exige au moins un scope App ou Front ; les droits de gestion sont contrôlés côté API. Le fournisseur est choisi dans une liste fermée, sans saisie de JavaScript. Le chargement après consentement n'est pas encore implémenté : aucune configuration ne déclenche de suivi pour le moment.

## Configuration prête à renseigner

Lors de l'ajout, choisir Google Analytics 4 ou Meta Pixel : le formulaire propose automatiquement le nom, la finalité, la description et la politique de confidentialité du fournisseur. Renseigner l'identifiant, choisir App et/ou Front, vérifier les informations proposées et enregistrer. La création reste inactive et nécessite ensuite une activation explicite. Changer de fournisseur réinitialise l'identifiant et les informations proposées sans effacer les scopes ; ouvrir un traceur existant ne modifie rien. Les descriptions sont éditables et doivent refléter l'usage réel. Les loaders ne sont pas encore activés.

## GA4 : préparation du compte fournisseur

Pour le futur suivi de navigation géré par SymSvel, désactiver les pageviews automatiques liés aux changements d'historique dans les mesures améliorées GA4 et vérifier les destinations liées à la balise (notamment publicitaires). Le module ne contrôle pas les paramètres du compte Google ; vérifier également les données remontées et l'absence d'identifiants personnels avant activation. L'adaptateur GA4 est introduit côté code mais pas encore monté dans les interfaces.
