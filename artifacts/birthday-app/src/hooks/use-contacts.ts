import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUpcomingBirthdays as useGeneratedUpcoming,
  useListContacts as useGeneratedList,
  useCreateContact as useGeneratedCreate,
  useUpdateContact as useGeneratedUpdate,
  useDeleteContact as useGeneratedDelete,
  useGetContact as useGeneratedGet,
  getListContactsQueryKey,
  getGetUpcomingBirthdaysQueryKey,
  getGetContactQueryKey
} from "@workspace/api-client-react";
import { getAuthHeaders } from "./use-auth";

export function useUpcomingBirthdays() {
  return useGeneratedUpcoming({
    request: { headers: getAuthHeaders() },
    query: {
      retry: 1,
    }
  });
}

export function useContacts(search?: string) {
  return useGeneratedList(
    { search },
    {
      request: { headers: getAuthHeaders() },
      query: { enabled: search !== undefined }
    }
  );
}

export function useContact(id: number | null) {
  return useGeneratedGet(id as number, {
    request: { headers: getAuthHeaders() },
    query: {
      enabled: !!id,
      retry: false
    }
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    request: { headers: getAuthHeaders() },
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUpcomingBirthdaysQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      }
    }
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useGeneratedUpdate({
    request: { headers: getAuthHeaders() },
    mutation: {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetUpcomingBirthdaysQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetContactQueryKey(variables.id) });
      }
    }
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useGeneratedDelete({
    request: { headers: getAuthHeaders() },
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetUpcomingBirthdaysQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        queryClient.removeQueries({ queryKey: getGetContactQueryKey(variables.id) });
      }
    }
  });
}
