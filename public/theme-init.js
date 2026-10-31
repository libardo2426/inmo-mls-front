// Aplica el tema antes del primer render para evitar el parpadeo.
// Es un script externo (no inline) por la CSP estricta (ADR-0005).
(function () {
  try {
    var stored = null;
    try {
      stored = window.localStorage.getItem('innmo-theme');
    } catch {
      stored = null;
    }
    var prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored !== 'light' && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch {
    /* sin tema: queda el claro por defecto */
  }
})();
