/**
 * Una feature no importa de otra (ADR-0001). Genera un bloque de configuración
 * por feature que prohíbe importar de las demás, por alias o por ruta relativa.
 */
export function featureBoundaryConfig(features) {
  return features.flatMap((feature) => {
    const others = features.filter((f) => f !== feature);
    // Con una sola feature no hay a quién prohibir importar (un `group` vacío es inválido).
    if (others.length === 0) return [];
    const patterns = others.flatMap((other) => [
      `@/features/${other}`,
      `@/features/${other}/**`,
      `../${other}`,
      `../${other}/**`,
      `../../${other}`,
      `../../${other}/**`,
    ]);
    return {
      files: [`src/features/${feature}/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: patterns,
                message:
                  'Una feature no importa de otra: sube lo compartido a `components/shared` o `lib`.',
              },
            ],
          },
        ],
      },
    };
  });
}
