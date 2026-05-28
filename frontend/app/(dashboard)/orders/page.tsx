"use client";

import { useState } from "react";
import Link from "next/link";
import { useOrders } from "@/hooks/useOrders";
import { PageShell } from "@/components/PageShell";
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
import { Order, BookStatus } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DOT_COLOR: Record<BookStatus, string> = {
  deposit:        "bg-yellow-300",
  paid:           "bg-blue-300",
  bought:         "bg-violet-300",
  under_delivery: "bg-orange-300",
  delivered:      "bg-emerald-400",
  cancelled:      "bg-gray-300 opacity-40",
};

const STATUS_LABEL: Record<BookStatus, string> = {
  deposit:        "Deposit",
  paid:           "Paid",
  bought:         "Bought",
  under_delivery: "Under delivery",
  delivered:      "Delivered",
  cancelled:      "Cancelled",
};

function BookDots({ books }: { books: Order["order_books"] }) {
  if (books.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

  const counts = books.reduce<Partial<Record<BookStatus, number>>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const tooltip = (Object.entries(counts) as [BookStatus, number][])
    .map(([s, n]) => `${n} ${STATUS_LABEL[s]}`)
    .join(", ");

  return (
    <div className="flex items-center gap-1" title={tooltip}>
      {books.map((book) => (
        <span
          key={book.id}
          className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLOR[book.status]}`}
        />
      ))}
    </div>
  );
}

const ACTIVE_LEGEND: { status: BookStatus; label: string }[] = [
  { status: "deposit",        label: "Deposit" },
  { status: "paid",           label: "Paid" },
  { status: "bought",         label: "Bought" },
  { status: "under_delivery", label: "In transit" },
  { status: "delivered",      label: "Delivered" },
];

const ALL_LEGEND = [...ACTIVE_LEGEND, { status: "cancelled" as BookStatus, label: "Cancelled" }];

type FilterMode = "active" | "all";

export default function OrdersPage() {
  const { data: orders, isLoading } = useOrders();
  const [filter, setFilter] = useState<FilterMode>("active");

  const displayed = (orders ?? []).filter(
    (o) => filter === "all" || o.status === "active"
  );

  const legend = filter === "active" ? ACTIVE_LEGEND : ALL_LEGEND;

  return (
    <PageShell
      title="Orders"
      action={
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center rounded-lg border p-0.5 gap-0.5">
            {(["active", "all"] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize",
                  filter === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === "active" ? "Active" : "All"}
              </button>
            ))}
          </div>
          <Link href="/orders/new" className={buttonVariants({ size: "sm" })}>
            <Plus size={14} className="mr-1" />
            New order
          </Link>
        </div>
      }
    >
      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {legend.map(({ status, label }) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLOR[status]}`} />
            {label}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Books</TableHead>
              <TableHead>Postage</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((order) => {
              const cancelled = order.status === "cancelled";
              return (
                <TableRow
                  key={order.id}
                  className={cancelled ? "opacity-50" : undefined}
                >
                  <TableCell className="font-medium tabular-nums text-muted-foreground">
                    #{order.id}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                  </TableCell>
                  <TableCell>
                    <BookDots books={order.order_books} />
                  </TableCell>
                  <TableCell>
                    <PostageBadge type={order.postage_type} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {Number(order.total_outstanding) > 0 ? (
                      <span className="text-destructive font-medium">
                        RM {Number(order.total_outstanding).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <ArrowRight size={14} />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {displayed.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  {filter === "active" ? "No active orders." : "No orders yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </PageShell>
  );
}
