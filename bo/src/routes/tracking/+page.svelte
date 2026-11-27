<script lang="ts">
  import { getProjectBrand } from '../../../../branding';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import Button from '../../../../components/Button.svelte';
  import Alert from '../../../../components/Alert.svelte';
  import Dropdown from '../../../../components/Dropdown.svelte';
  import Modal from '../../../../components/Modal.svelte';
  import InputField from '../../../../components/InputField.svelte';
  import DataTable from '../../../../components/DataTable.svelte';
  import type { DataAction, DataColumn, SortOrder } from '../../../../components/data-table';
  import type { PageSize } from '../../../../components/pagination';
  import { ApiError } from '../../../../api/client';
  import { boApi } from '../../../../api/session';
  import { uiLanguage } from '../../../../api/locales';
  import { trackerInput, trackingCopy, filterTrackers, type TrackerInput, type BoTracker, type BoTrackingResponse } from '../../presentation';

  const brandName = getProjectBrand();
  let rows = $state<BoTracker[]>([]);
  let providers = $state<Record<string, string>>({});
  let canManage = $state(false);
  let loading = $state(false);
  let saving = $state(false);
  let editing = $state<BoTracker | null>(null);
  let showForm = $state(false);
  let draft = $state<TrackerInput>(trackerInput());
  let search = $state('');
  let sortKey = $state<string | null>('name');
  let sortOrder = $state<SortOrder>('asc');
  let page = $state(1);
  let limit = $state<PageSize>(20);
  let error = $state('');
  let formError = $state('');
  let notice = $state('');

  const locale = $derived($uiLanguage ?? (typeof navigator === 'undefined' ? 'fr' : navigator.language));
  const t = $derived(trackingCopy(locale));
  const filtered = $derived(filterTrackers(rows, search, sortKey, sortOrder === 'desc', locale));
  const visible = $derived(filtered.slice((page - 1) * limit, page * limit));
  const columns = $derived<DataColumn<BoTracker>[]>([
    { key: 'name', label: t.name, sortable: true },
    { key: 'provider', label: t.provider, sortable: true, format: (_, row) => providers[row.provider] ?? row.provider },
    { key: 'purpose', label: t.purpose, sortable: true },
    { key: 'scopes', label: t.scopes, format: (_, row) => row.scopes.map(scope => scope === 'app' ? 'App' : 'Front').join(', ') },
    { key: 'active', label: t.active, format: (value) => value ? t.enabled : t.disabled }
  ]);
  const actions = $derived<DataAction<BoTracker>[]>(canManage ? [
    { key: 'edit', label: t.edit, variant: 'secondary', disabled: () => saving || loading, onClick: open },
    { key: 'toggle', label: row => row.active ? t.disable : t.enable,
      variant: row => row.active ? 'warning' : 'success', disabled: () => saving || loading,
      onClick: row => { void toggle(row); } }
  ] : []);

  function explain(cause: unknown): string {
    if (cause instanceof ApiError) {
      if (cause.status === 401) { void goto(resolve('/login'), { replaceState: true }); return t.session; }
      if (cause.status === 403) return t.forbidden;
      if (cause.status === 409) return t.conflict;
      if (cause.status === 400) return t.invalid;
    }
    return t.failure;
  }

  async function load(): Promise<void> {
    if (loading || saving) return;
    loading = true;
    error = '';
    try {
      const response = await boApi<BoTrackingResponse>('/apibo/tracking');
      rows = Array.isArray(response.data) ? response.data : [];
      providers = response.providers ?? {};
      canManage = response.can_manage === true;
      page = 1;
    } catch (cause) {
      canManage = false;
      error = explain(cause);
    } finally {
      loading = false;
    }
  }
  onMount(() => { void load(); });

  function open(row?: BoTracker): void {
    if (!canManage || saving || loading) return;
    editing = row ?? null;
    draft = trackerInput(row);
    if (!row) draft.provider = Object.keys(providers)[0] ?? '';
    formError = '';
    showForm = true;
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (saving || !canManage) return;
    if (!draft.scopes.length) { formError = t.scopeRequired; return; }
    saving = true;
    formError = '';
    notice = '';
    const row = editing;
    const input = trackerInput(draft);
    try {
      const response = await boApi<{ data: BoTracker }>(row ? '/apibo/tracking/' + encodeURIComponent(row.id) : '/apibo/tracking', {
        method: row ? 'PUT' : 'POST',
        body: JSON.stringify(row ? { ...input, revision: row.revision, active: row.active } : input)
      });
      rows = row ? rows.map(current => current.id === row.id ? response.data : current) : [...rows, response.data];
      page = 1;
      showForm = false;
      notice = t.saved;
    } catch (cause) {
      formError = explain(cause);
    } finally {
      saving = false;
    }
  }

  async function toggle(row: BoTracker): Promise<void> {
    if (!canManage || saving) return;
    saving = true;
    error = '';
    notice = '';
    try {
      const response = await boApi<{ data: BoTracker }>('/apibo/tracking/' + encodeURIComponent(row.id), {
        method: 'PUT',
        body: JSON.stringify({ ...trackerInput(row), active: !row.active, revision: row.revision })
      });
      rows = rows.map(current => current.id === row.id ? response.data : current);
      notice = t.saved;
    } catch (cause) {
      error = explain(cause);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{t.title} | {$brandName} BO</title></svelte:head>
<div class="tracking-page">
  <header class="page-heading">
    <div><h1>{t.title}</h1><p>{t.intro}</p></div>
    <div class="actions">
      <Button variant="secondary" onclick={load} disabled={loading || saving}>{t.refresh}</Button>
      {#if canManage}<Button onclick={() => open()} disabled={loading || saving || Object.keys(providers).length === 0}>{t.create}</Button>{/if}
    </div>
  </header>
  <Alert kind="info">{t.unavailable}</Alert>
  {#if error}<Alert kind="error">{error}</Alert>{/if}
  {#if notice}<Alert kind="success">{notice}</Alert>{/if}
  <section class="panel">
    <DataTable rows={visible} {columns} {actions} {loading} rowKey="id" emptyMessage={t.empty}
      filters={[{ key: 'search', label: t.search, type: 'search', placeholder: t.searchHint }]}
      filterValues={{ search }}
      onFilterChange={(_, value) => { search = value; page = 1; }}
      {sortKey} {sortOrder}
      onSortChange={(key, order) => { sortKey = key; sortOrder = order; page = 1; }}
      pagination={{ page, limit, total: filtered.length, onPageChange: value => page = value,
        onLimitChange: value => { limit = value; page = 1; } }}
    />
  </section>
  <Modal open={showForm} title={editing ? t.edit : t.create} onClose={() => showForm = false}>
    {#if formError}<Alert kind="error">{formError}</Alert>{/if}
    <form class="tracker-form" onsubmit={save}>
      <span class="field-label">{t.provider}</span>
      <Dropdown value={draft.provider} label={t.provider} disabled={saving}
        options={Object.entries(providers).map(([value, label]) => ({ value, label }))}
        onChange={value => { if (value !== draft.provider) draft.identifier = ''; draft.provider = value; }} />
      <InputField id="tracker-identifier" label={t.identifier} bind:value={draft.identifier} maxlength={255} required disabled={saving} />
      <InputField id="tracker-name" label={t.name} bind:value={draft.name} maxlength={150} required disabled={saving} />
      <InputField id="tracker-purpose" label={t.purpose} bind:value={draft.purpose} maxlength={150} required disabled={saving} />
      <label class="field-label" for="tracker-description">{t.description}</label>
      <textarea id="tracker-description" bind:value={draft.description} maxlength="10000" required disabled={saving} rows="4"></textarea>
      <InputField id="tracker-privacy" label={t.privacy} type="url" bind:value={draft.privacy_url} maxlength={2048} required disabled={saving} />
      <fieldset disabled={saving}>
        <legend>{t.scopes}</legend>
        <label><input type="checkbox" value="app" bind:group={draft.scopes} /> App</label>
        <label><input type="checkbox" value="front" bind:group={draft.scopes} /> Front</label>
      </fieldset>
      <small>{editing ? t.revisionInfo : t.inactiveInfo}</small>
      <div class="actions">
        <Button variant="secondary" onclick={() => showForm = false} disabled={saving}>{t.cancel}</Button>
        <Button type="submit" variant="success" loading={saving} disabled={!draft.provider || !draft.scopes.length}>{t.save}</Button>
      </div>
    </form>
  </Modal>
</div>

<style>
  .tracking-page { max-width: 1200px; margin: auto; display: grid; gap: 20px; color: var(--bo-text); }
  .page-heading, .actions { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .page-heading h1 { margin: 0; }
  .page-heading p, small { color: var(--bo-muted); }
  .panel { padding: 24px; background: var(--bo-surface); border: 1px solid var(--bo-border); border-radius: 14px; min-width: 0; }
  .tracker-form { display: grid; gap: 12px; }
  .field-label, legend { font-weight: 650; }
  textarea { width: 100%; padding: 11px; border: 1px solid var(--bo-border); border-radius: 8px; font: inherit; background: var(--bo-input); color: var(--bo-text); }
  textarea:focus-visible { outline: 2px solid var(--bo-focus); outline-offset: 2px; }
  fieldset { border: 1px solid var(--bo-border); border-radius: 10px; display: flex; flex-wrap: wrap; gap: 18px; }
  fieldset input { accent-color: var(--bo-primary); }
  .tracker-form .actions { justify-content: flex-end; }
</style>
