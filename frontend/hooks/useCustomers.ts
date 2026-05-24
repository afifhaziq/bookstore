import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ["customers", search],
    queryFn: () => api.customers.list(search),
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: () => api.customers.get(id),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.customers.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; phone_number?: string; default_address?: string }) =>
      api.customers.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.customers.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
