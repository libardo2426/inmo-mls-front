export {};

declare global {
  interface Window {
    /** Configuración de runtime inyectada por `/config.js` (ver ADR-0005). */
    __APP_CONFIG__?: unknown;
  }
}
