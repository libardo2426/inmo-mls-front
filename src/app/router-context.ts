import type { QueryClient } from '@tanstack/react-query';
import type { HttpClient } from '@/lib/http';

/** Contexto disponible en `beforeLoad`/`loader` de todas las rutas. */
export type RouterContext = { queryClient: QueryClient; http: HttpClient };
