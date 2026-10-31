export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Los commits van en español: no se fuerza el estilo de mayúsculas del asunto.
    'subject-case': [0],
  },
};
