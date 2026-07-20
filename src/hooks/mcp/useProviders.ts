import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/mcpProviders';
import { mcpKeys } from './keys';

export function useProviders(filters?: api.ProviderFilters) {
  return useQuery({
    queryKey: mcpKeys.providers(filters),
    queryFn: () => api.listProviders(filters),
  });
}

export function useProvider(providerId: string | undefined) {
  return useQuery({
    queryKey: mcpKeys.provider(providerId || ''),
    queryFn: () => api.getProvider(providerId!),
    enabled: !!providerId,
  });
}

export function useProviderCapabilities(providerId: string | undefined) {
  return useQuery({
    queryKey: mcpKeys.capabilities(providerId || ''),
    queryFn: () => api.getProviderCapabilities(providerId!),
    enabled: !!providerId,
  });
}

export function useProviderRequiredCredentials(providerId: string | undefined) {
  return useQuery({
    queryKey: mcpKeys.credentials(providerId || ''),
    queryFn: () => api.getProviderRequiredCredentials(providerId!),
    enabled: !!providerId,
  });
}

export function useEnableProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => api.enableProvider(providerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useDisableProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => api.disableProvider(providerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}
