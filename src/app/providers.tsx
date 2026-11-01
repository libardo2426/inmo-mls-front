import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { AppContext } from '@/app/app-context';
import { ThemeProvider } from '@/app/theme/ThemeProvider';
import type { AppConfig } from '@/lib/config';
import type { HttpClient } from '@/lib/http';

type ProvidersProps = {
  config: AppConfig;
  queryClient: QueryClient;
  http: HttpClient;
  children: ReactNode;
};

export function Providers({ config, queryClient, http, children }: ProvidersProps) {
  const value = useMemo(() => ({ config, http }), [config, http]);

  return (
    <AppContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </AppContext.Provider>
  );
}
