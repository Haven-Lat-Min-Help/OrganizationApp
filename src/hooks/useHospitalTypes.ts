import { useEffect, useState } from 'react';
import { apiFetch } from '../config/api';

export interface HospitalType {
  id: string;
  name: string;
}

interface HospitalTypesState {
  /** Empty while loading and when the request failed (see `error`). */
  hospitalTypes: HospitalType[];
  error: string | null;
}

/** Loads the hospital-type catalogue (GET /hospitals/types) once per mount. */
export function useHospitalTypes(): HospitalTypesState {
  const [state, setState] = useState<HospitalTypesState>({ hospitalTypes: [], error: null });

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ hospital_types: HospitalType[] }>('/hospitals/types')
      .then((data) => {
        if (!cancelled) setState({ hospitalTypes: data.hospital_types, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ hospitalTypes: [], error: 'Could not load hospital types' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
