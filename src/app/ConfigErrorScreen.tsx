import type { ConfigError } from '@/lib/config';
import { es } from '@/lib/i18n/es';

export function ConfigErrorScreen({ error }: { error: ConfigError }) {
  return (
    <main role="alert">
      <h1>{es.config.errorTitle}</h1>
      <p>{es.config.errorHelp}</p>
      <ul>
        {error.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </main>
  );
}
