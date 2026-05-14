"use client";

import Link from "next/link";
import { useOrders } from "@/hooks/useOrders";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { PostageBadge } from "@/components/PostageBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function OrdersPage() {
  const { data: orders, isLoading } = useOrders();

  return (
    <PageShell
      title="Orders"
      action={
        <Link href="/orders/new" className={buttonVariants({ size: "sm" })}>
          New order
        </Link>
      }
    >
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Books</TableHead>
              <TableHead>Postage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium hover:underline"
                  >
                    #{order.id}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {order.address}
                </TableCell>
                <TableCell>{order.books.length}</TableCell>
                <TableCell>
                  <PostageBadge type={order.postage_type} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {order.total_outstanding > 0 ? (
                    <span className="text-destructive">
                      RM {order.total_outstanding.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {orders?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No orders yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </PageShell>
  );
}
