import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useBooks() {
  return useQuery({
    queryKey: ["books"],
    queryFn: api.books.list,
  });
}

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.books.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useUpdateBook(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.books.update>[1]) =>
      api.books.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.books.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
