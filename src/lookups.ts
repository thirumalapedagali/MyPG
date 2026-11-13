import { useEffect, useState } from 'react';
import { get } from './api';

/** One option of a dropdown stored in the backend `lookup_values` table. */
export type LookupItem = { code: string; label: string; extra?: string | null };

export const STAY_TYPE = 'STAY_TYPE';
export const GENDER_POLICY = 'GENDER_POLICY';
export const COMPLAINT_CATEGORY = 'COMPLAINT_CATEGORY';
export const EXPENSE_TYPE = 'EXPENSE_TYPE';

const cache = new Map<string, LookupItem[]>();

/** Dropdown options for a category (e.g. STAY_TYPE), fetched once per app session. */
export function useLookup(category: string): LookupItem[] {
  const [items, setItems] = useState<LookupItem[]>(cache.get(category) ?? []);
  useEffect(() => {
    if (cache.has(category)) return;
    let alive = true;
    get<LookupItem[]>(`/api/lookups?category=${category}`)
      .then((list) => {
        cache.set(category, list);
        if (alive) setItems(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [category]);
  return items;
}

/** What a unit is called for a stay type (Flat, Dorm, Room...), from the table's `extra` column. */
export const unitLabelFor = (types: LookupItem[], code: string | undefined | null) =>
  types.find((t) => t.code === (code ?? '').toUpperCase())?.extra || 'Room';
