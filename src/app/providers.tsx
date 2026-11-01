import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { AppContext } from '@/app/app-context';
import { createQueryClient } from '@/app/query-client';
import { ThemeProvider } from '@/app/theme/ThemeProvider';
import type { AppConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';

export function Providers({ config, children }: { config: AppConfig; children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const value = useMemo(() => ({ config, http: createHttpClient({ config }) }), [config]);

  return (
    <AppContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </AppContext.Provider>
  );
}
