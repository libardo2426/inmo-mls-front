import { z } from 'zod';

// Zod 4 compila validadores con `new Function`; la CSP (sin 'unsafe-eval') lo bloquea y
// el navegador registra una violación aunque Zod la capture. Se desactiva el JIT.
// Debe importarse antes que cualquier otro módulo que use Zod.
z.config({ jitless: true });
