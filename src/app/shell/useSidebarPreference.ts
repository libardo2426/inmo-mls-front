import { useCallback, useState } from 'react';

const STORAGE_KEY = 'inmo.sidebar-open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Si el menú lateral está abierto, recordado en el navegador (la app funciona sin `localStorage`). */
export function useSidebarPreference(): [open: boolean, setOpen: (open: boolean) => void] {
  const [open, setOpenState] = useState(readOpen);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* sin almacenamiento: la preferencia vive solo en memoria */
    }
  }, []);
  return [open, setOpen];
}
