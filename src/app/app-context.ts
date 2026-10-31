import { createContext, useContext } from 'react';
import type { AppConfig } from '@/lib/config';
import type { HttpClient } from '@/lib/http';

export type AppContextValue = { config: AppConfig; http: HttpClient };

export const AppContext = createContext<AppContextValue | null>(null);

function useAppContext(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('Falta <Providers> en el árbol de React');
  return value;
}

export function useAppConfig(): AppConfig {
  return useAppContext().config;
}

export function useHttpClient(): HttpClient {
  return useAppContext().http;
}
