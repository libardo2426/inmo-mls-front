import { setupServer } from 'msw/node';

/** Servidor MSW compartido por los tests; cada test registra sus propios handlers. */
export const server = setupServer();
