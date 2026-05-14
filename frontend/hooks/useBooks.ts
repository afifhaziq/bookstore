import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BookStatus } from "@/lib/api";

export function useBooks(params?: { status?: BookStatus; outstanding_only?: boolean }) {
  return useQuery({
    queryKey: ["books", params],
    queryFn: () => api.books.list(params),
  });
}

export function useUpdateBook(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      author?: string;
      status?: BookStatus;
      total_price?: string;
      deposit_amount?: string;
    }) => api.books.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.books.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
