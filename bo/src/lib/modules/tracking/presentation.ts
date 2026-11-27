import { generatedTranslation } from '../../i18n/generated-translations';

export type TrackerScope = 'app' | 'front';
export type TrackerInput = {
  provider: string; identifier: string; name: string; purpose: string; description: string;
  privacy_url: string; scopes: TrackerScope[];
};
export type BoTracker = TrackerInput & { id: string; active: boolean; revision: number };
export type BoTrackingResponse = { data: BoTracker[]; providers: Record<string, string>; can_manage: boolean };
const copy = {
  "fr": {
    "title": "Traceurs",
    "intro": "Catalogue des traceurs tiers pour App et Front. Aucun suivi dans le BO.",
    "name": "Nom",
    "provider": "Fournisseur",
    "identifier": "Identifiant technique",
    "purpose": "Finalité",
    "description": "Description",
    "privacy": "Politique de confidentialité (URL HTTPS)",
    "scopes": "Interfaces",
    "active": "État",
    "enabled": "Actif",
    "disabled": "Inactif",
    "enable": "Activer",
    "disable": "Désactiver",
    "create": "Ajouter un traceur",
    "edit": "Modifier",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "refresh": "Actualiser",
    "search": "Rechercher",
    "searchHint": "Nom, fournisseur ou finalité",
    "empty": "Aucun traceur.",
    "saved": "Traceur enregistré.",
    "invalid": "Configuration invalide : vérifier les champs et les interfaces.",
    "conflict": "Le traceur a été modifié. Actualiser avant une nouvelle tentative.",
    "forbidden": "Accès interdit.",
    "session": "Session expirée.",
    "failure": "Impossible de traiter les traceurs.",
    "scopeRequired": "Choisir au moins une interface.",
    "inactiveInfo": "Un nouveau traceur est toujours créé inactif.",
    "revisionInfo": "Toute modification renouvelle la révision et invalide les anciens consentements.",
    "unavailable": "Le chargement des traceurs n'est pas encore raccordé au consentement GDPR."
  },
  "en": {
    "title": "Trackers",
    "intro": "Third-party tracker catalogue for App and Front. No tracking in the BO.",
    "name": "Name",
    "provider": "Provider",
    "identifier": "Technical identifier",
    "purpose": "Purpose",
    "description": "Description",
    "privacy": "Privacy policy (HTTPS URL)",
    "scopes": "Interfaces",
    "active": "Status",
    "enabled": "Active",
    "disabled": "Inactive",
    "enable": "Enable",
    "disable": "Disable",
    "create": "Add tracker",
    "edit": "Edit",
    "save": "Save",
    "cancel": "Cancel",
    "refresh": "Refresh",
    "search": "Search",
    "searchHint": "Name, provider or purpose",
    "empty": "No trackers.",
    "saved": "Tracker saved.",
    "invalid": "Invalid configuration: check the fields and interfaces.",
    "conflict": "The tracker has changed. Refresh before trying again.",
    "forbidden": "Access denied.",
    "session": "Session expired.",
    "failure": "Cannot process trackers.",
    "scopeRequired": "Select at least one interface.",
    "inactiveInfo": "A new tracker is always created inactive.",
    "revisionInfo": "Every change creates a new revision and invalidates previous consents.",
    "unavailable": "Tracker loading is not yet connected to GDPR consent."
  }
};
export type TrackingCopy = typeof copy.fr;
export function trackingCopy(locale: string | null): TrackingCopy {
  const source = locale?.toLowerCase().startsWith('en') ? copy.en : copy.fr;
  return Object.fromEntries(Object.entries(source).map(([key, value]) =>
    [key, generatedTranslation(locale, 'bo.tracking.' + key) ?? value])) as TrackingCopy;
}

export function trackerInput(row?: TrackerInput): TrackerInput {
  return {
    provider: row?.provider ?? '', identifier: row?.identifier ?? '', name: row?.name ?? '',
    purpose: row?.purpose ?? '', description: row?.description ?? '', privacy_url: row?.privacy_url ?? '',
    scopes: [...(row?.scopes ?? [])]
  };
}

export function filterTrackers(rows: BoTracker[], search: string, sortKey: string | null, descending: boolean, locale: string): BoTracker[] {
  const term = search.trim().toLocaleLowerCase();
  const key = sortKey === 'provider' || sortKey === 'purpose' ? sortKey : 'name';
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return rows.filter(row => !term || [row.name, row.provider, row.purpose, row.identifier]
    .some(value => value.toLocaleLowerCase().includes(term)))
    .sort((a, b) => (collator.compare(a[key], b[key]) || a.id.localeCompare(b.id)) * (descending ? -1 : 1));
}
