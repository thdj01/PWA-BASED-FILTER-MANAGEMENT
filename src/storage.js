import { get, set, del } from 'idb-keyval';

export const saveFilters = async (filters) => {
  await set('filters', filters);
  await set('lastUpdated', new Date().toISOString());
};

export const loadFilters = async () => {
  const filters = await get('filters');
  const lastUpdated = await get('lastUpdated');
  return { filters, lastUpdated };
};

export const savePendingChanges = async (changes) => {
  await set('pendingChanges', changes);
};

export const getPendingChanges = async () => {
  return await get('pendingChanges');
};

export const clearPendingChanges = async () => {
  await del('pendingChanges');
};
