import { useQuery } from '@tanstack/react-query';
import { useHttpClient } from '@/app/app-context';
import { useMe } from '@/lib/permissions';
import { territoryUnitQueryOptions } from './territory-api';

/**
 * Nombre de un `territorialUnitCode` como «Municipio, Departamento». Si el departamento no se
 * resuelve devuelve solo el municipio; si tampoco, el código. Nunca lanza.
 */
export function useTerritoryName(code: string | undefined): { label: string; isLoading: boolean } {
  const http = useHttpClient();
  const country = useMe().tenant.code;
  const enabled = code !== undefined && code !== '';

  const municipality = useQuery({
    ...territoryUnitQueryOptions(http, country, 'municipality', code ?? ''),
    enabled,
  });
  const parentCode = municipality.data?.parentCode ?? undefined;
  const department = useQuery({
    ...territoryUnitQueryOptions(http, country, 'department', parentCode ?? ''),
    enabled: parentCode !== undefined,
  });

  if (!enabled) return { label: '', isLoading: false };
  const municipalityName = municipality.data?.name;
  if (municipalityName === undefined) return { label: code, isLoading: municipality.isPending };
  const departmentName = department.data?.name;
  return {
    label: departmentName ? `${municipalityName}, ${departmentName}` : municipalityName,
    isLoading: parentCode !== undefined && department.isPending,
  };
}
