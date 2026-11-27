import { describe, expect, it } from 'vitest';
import { filterTrackers, trackerInput, type BoTracker } from './presentation';

const row: BoTracker = {
  id: 'tracker-a', provider: 'google-analytics', identifier: 'G-ABC123',
  name: 'Audience', purpose: 'Mesure', description: 'Description', privacy_url: 'https://example.invalid/privacy',
  scopes: ['front'], active: true, revision: 3
};

describe('tracking BO catalogue', () => {
  it('only sends editable fields and never mutates the original scopes', () => {
    const input = trackerInput(row);
    expect(input).not.toHaveProperty('id');
    expect(input).not.toHaveProperty('revision');
    expect(input).not.toHaveProperty('active');
    input.scopes.push('app');
    expect(row.scopes).toEqual(['front']);
  });
  it('filters and sorts without mutating catalogue order', () => {
    const rows = [row, { ...row, id: 'tracker-b', name: 'Alpha', purpose: 'Statistics' }];
    expect(filterTrackers(rows, '', 'name', false, 'fr').map(r => r.id)).toEqual(['tracker-b', 'tracker-a']);
    expect(filterTrackers(rows, 'mesure', 'name', false, 'fr')).toEqual([row]);
    expect(rows[0].id).toBe('tracker-a');
  });
});
