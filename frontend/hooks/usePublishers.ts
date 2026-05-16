import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function usePublishers() {
  return useQuery({
    queryKey: ["publishers"],
    queryFn: api.publishers.list,
  });
}

export function useCreatePublisher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.publishers.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publishers"] });
    },
  });
}
