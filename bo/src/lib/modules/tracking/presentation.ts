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
    "creationInfo": "Le traceur sera actif dès sa création, mais aucun chargement sans consentement et route autorisée.",
    "revisionInfo": "Toute modification renouvelle la révision et invalide les anciens consentements.",
    "unavailable": "Le chargement dépend d’un consentement GDPR valide et de routes publiques explicitement autorisées."
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
    "creationInfo": "The tracker is active on creation, but loads only with consent and an allowed route.",
    "revisionInfo": "Every change creates a new revision and invalidates previous consents.",
    "unavailable": "Loading requires valid GDPR consent and explicitly allowed public routes."
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

const presetCopy = {
  "fr": {
    "gaName": "Google Analytics 4",
    "gaPurpose": "Mesure d'audience",
    "gaDescription": "Mesure de fréquentation et statistiques de navigation afin d'améliorer le site ou l'application.",
    "metaName": "Meta Pixel",
    "metaPurpose": "Mesure publicitaire",
    "metaDescription": "Mesure des interactions et des conversions liées aux campagnes publicitaires Meta."
  },
  "en": {
    "gaName": "Google Analytics 4",
    "gaPurpose": "Audience measurement",
    "gaDescription": "Traffic and navigation statistics to improve the website or application.",
    "metaName": "Meta Pixel",
    "metaPurpose": "Advertising measurement",
    "metaDescription": "Measurement of interactions and conversions related to Meta advertising campaigns."
  }
};

/** Editable suggestions only; selecting a provider never creates or activates a tracker. */
export function trackerPreset(provider: string, locale: string | null, scopes: TrackerScope[] = []): TrackerInput {
  const source = locale?.toLowerCase().startsWith('en') ? presetCopy.en : presetCopy.fr;
  const label = (key: keyof typeof presetCopy.fr) => generatedTranslation(locale, 'bo.tracking.' + key) ?? source[key];
  const draft = { ...trackerInput(), provider, scopes: [...scopes] };
  if (provider === 'google-analytics') return { ...draft, name: label('gaName'), purpose: label('gaPurpose'), description: label('gaDescription'), privacy_url: 'https://policies.google.com/privacy' };
  if (provider === 'meta-pixel') return { ...draft, name: label('metaName'), purpose: label('metaPurpose'), description: label('metaDescription'), privacy_url: 'https://www.facebook.com/privacy/policy/' };
  return draft;
}

export function filterTrackers(rows: BoTracker[], search: string, sortKey: string | null, descending: boolean, locale: string): BoTracker[] {
  const term = search.trim().toLocaleLowerCase();
  const key = sortKey === 'provider' || sortKey === 'purpose' ? sortKey : 'name';
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return rows.filter(row => !term || [row.name, row.provider, row.purpose, row.identifier]
    .some(value => value.toLocaleLowerCase().includes(term)))
    .sort((a, b) => (collator.compare(a[key], b[key]) || a.id.localeCompare(b.id)) * (descending ? -1 : 1));
}
