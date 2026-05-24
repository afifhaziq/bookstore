"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PostageBadge } from "@/components/PostageBadge";
import { type Order, type OrderBook } from "@/lib/api";

interface BookEntry {
  title: string;
  count: number;
  outstanding: number;
}

function groupOrderBooks(orderBooks: OrderBook[]): BookEntry[] {
  const map = new Map<number, BookEntry>();
  for (const ob of orderBooks) {
    if (!map.has(ob.book_id)) {
      map.set(ob.book_id, { title: ob.title, count: 0, outstanding: 0 });
    }
    const entry = map.get(ob.book_id)!;
    entry.count++;
    entry.outstanding += ob.outstanding_amount;
  }
  return Array.from(map.values());
}

function OutstandingBooks({ books }: { books: BookEntry[] }) {
  return (
    <div className="space-y-1">
      {books.map((b) => (
        <div key={b.title} className="flex items-baseline justify-between gap-4 text-xs">
          <span className="text-foreground">
            {b.title}
            {b.count > 1 && (
              <span className="ml-1 text-muted-foreground">×{b.count}</span>
            )}
          </span>
          {b.outstanding > 0 ? (
            <span className="tabular-nums text-destructive font-medium shrink-0">
              RM {b.outstanding.toFixed(2)}
            </span>
          ) : (
            <span className="text-primary shrink-0">✓</span>
          )}
        </div>
      ))}
    </div>
  );
}

function OrderTotal({ outstanding }: { outstanding: number }) {
  return Number(outstanding) > 0 ? (
    <span className="font-medium tabular-nums text-destructive">
      RM {Number(outstanding).toFixed(2)}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export function PackagingTable({ orders }: { orders: Order[] }) {
  const active = orders.filter((o) => o.status !== "cancelled");

  if (active.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No active orders.
      </p>
    );
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="space-y-3 sm:hidden">
        {active.map((order) => {
          const books = groupOrderBooks(order.order_books);
          return (
            <div key={order.id} className="rounded-lg border p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    #{order.id}
                  </span>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {/* Address */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {order.address}
              </p>

              {/* Postage */}
              {order.postage_type && (
                <PostageBadge type={order.postage_type} />
              )}

              {/* Books with outstanding */}
              {books.length > 0 && (
                <div className="border-t pt-3">
                  <OutstandingBooks books={books} />
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground text-xs">Total outstanding</span>
                <OrderTotal outstanding={order.total_outstanding} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="w-52">Address</TableHead>
              <TableHead>Postage</TableHead>
              <TableHead>Outstanding Balance</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((order) => {
              const books = groupOrderBooks(order.order_books);
              return (
                <TableRow key={order.id} className="align-top">
                  <TableCell className="pt-3.5 font-medium tabular-nums text-muted-foreground">
                    #{order.id}
                  </TableCell>
                  <TableCell className="pt-3.5">
                    <p className="text-sm font-medium">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                  </TableCell>
                  <TableCell className="pt-3.5 text-xs text-muted-foreground leading-relaxed">
                    {order.address}
                  </TableCell>
                  <TableCell className="pt-3.5">
                    <PostageBadge type={order.postage_type} />
                  </TableCell>
                  <TableCell className="pt-2">
                    <OutstandingBooks books={books} />
                  </TableCell>
                  <TableCell className="pt-3.5 text-right text-sm">
                    <OrderTotal outstanding={order.total_outstanding} />
                  </TableCell>
                  <TableCell className="pt-3">
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
          </TableBody>
        </Table>
      </div>
    </>
  );
}
