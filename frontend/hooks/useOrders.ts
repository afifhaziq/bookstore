import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PostageType, CopySpec, BookStatus } from "@/lib/api";

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: api.orders.list,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () => api.orders.get(id),
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.orders.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateOrder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { address?: string; note?: string; postage_type?: PostageType; postage_amount?: string; postage_paid?: boolean }) =>
      api.orders.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useAddCopiesToOrder(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (copies: CopySpec[]) => api.orders.addCopies(orderId, copies),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateOrderBook(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obId, data }: { obId: number; data: { status?: BookStatus; deposit_amount?: string } }) =>
      api.orders.updateOrderBook(orderId, obId, data),
    onSuccess: (updatedOrder, variables) => {
      // Use the returned OrderDetail directly — avoids a second round-trip
      qc.setQueryData(["orders", orderId], updatedOrder);
      // List and dashboard only care about status, not deposit amounts
      if (variables.data.status !== undefined) {
        qc.invalidateQueries({ queryKey: ["orders"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      }
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.orders.cancel,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["orders", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReactivateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.orders.reactivate,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["orders", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
