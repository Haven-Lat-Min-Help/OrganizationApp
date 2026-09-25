import { useEffect, useState } from 'react';
import { apiFetch } from '../config/api';
import type { StaffAidType } from '../types/staff';

interface AidTypesState {
  /** Empty while loading and when the request failed (see `error`). */
  aidTypes: StaffAidType[];
  error: string | null;
}

/**
 * Loads the aid-type catalogue (GET /aid-types, sorted by name) once per
 * mount — the options a branch admin picks from when inviting or editing
 * staff. Same shape as useHospitalTypes.
 */
export function useAidTypes(): AidTypesState {
  const [state, setState] = useState<AidTypesState>({ aidTypes: [], error: null });

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ aid_types: StaffAidType[] }>('/aid-types')
      .then((data) => {
        if (!cancelled) setState({ aidTypes: data.aid_types, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ aidTypes: [], error: 'Could not load aid types' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
