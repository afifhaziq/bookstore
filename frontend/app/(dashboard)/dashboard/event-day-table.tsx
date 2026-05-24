"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ColumnDef, type Row, type ExpandedState } from "@tanstack/react-table";
import { GlowingBadge, type GlowingBadgeVariant } from "@/components/ui/glowing-badge";
import { DataTable } from "@/components/ui/data-table";
import { useUpdateOrderBook } from "@/hooks/useOrders";
import { type Order, type BookStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type CopyRow = {
  _kind: "copy";
  ob_id: number;
  order_id: number;
  customer_name: string;
  customer_phone: string;
  ob_status: BookStatus;
  outstanding_amount: number;
};

type BookRow = {
  _kind: "book";
  book_id: number;
  publisher_name: string;
  title: string;
  active_qty: number;
  bought_qty: number;
  total_qty: number;
  is_complete: boolean;
  subRows: CopyRow[];
};

type PubRow = {
  _kind: "pub";
  publisher_name: string;
  subRows: BookRow[];
};

type EventRow = PubRow | BookRow | CopyRow;

// ── Data builder ───────────────────────────────────────────────────────────────

function buildRows(orders: Order[]): PubRow[] {
  const pubMap = new Map<string, Map<number, BookRow>>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const ob of order.order_books) {
      if (ob.status !== "deposit" && ob.status !== "paid" && ob.status !== "bought")
        continue;

      if (!pubMap.has(ob.publisher_name)) pubMap.set(ob.publisher_name, new Map());
      const bookMap = pubMap.get(ob.publisher_name)!;

      if (!bookMap.has(ob.book_id)) {
        bookMap.set(ob.book_id, {
          _kind: "book",
          book_id: ob.book_id,
          publisher_name: ob.publisher_name,
          title: ob.title,
          active_qty: 0,
          bought_qty: 0,
          total_qty: 0,
          is_complete: false,
          subRows: [],
        });
      }

      const book = bookMap.get(ob.book_id)!;
      if (ob.status === "bought") book.bought_qty++;
      else book.active_qty++;
      book.total_qty++;
      book.subRows.push({
        _kind: "copy",
        ob_id: ob.id,
        order_id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        ob_status: ob.status,
        outstanding_amount: ob.outstanding_amount,
      });
    }
  }

  const pubs: PubRow[] = [];
  for (const [name, bookMap] of pubMap) {
    const books = Array.from(bookMap.values()).map((b) => ({
      ...b,
      is_complete: b.active_qty === 0,
    }));
    // active books first, bought/complete at bottom; alphabetical within each group
    books.sort(
      (a, b) =>
        Number(a.is_complete) - Number(b.is_complete) ||
        a.title.localeCompare(b.title)
    );
    pubs.push({ _kind: "pub", publisher_name: name, subRows: books });
  }
  pubs.sort((a, b) => a.publisher_name.localeCompare(b.publisher_name));
  return pubs;
}

// ── Status badge ───────────────────────────────────────────────────────────────

const EVENT_STATUSES: { value: BookStatus; label: string }[] = [
  { value: "deposit", label: "Deposit" },
  { value: "paid", label: "Paid" },
  { value: "bought", label: "Bought" },
];

const STATUS_BADGE_VARIANT: Record<BookStatus, GlowingBadgeVariant> = {
  deposit: "deposit",
  paid: "paid",
  bought: "bought",
  under_delivery: "warning",
  delivered: "success",
  cancelled: "neutral",
};

const STATUS_LABELS: Record<BookStatus, string> = {
  deposit: "Deposit",
  paid: "Paid",
  bought: "Bought",
  under_delivery: "Under Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function CopyStatusBadge({
  orderId,
  obId,
  currentStatus,
}: {
  orderId: number;
  obId: number;
  currentStatus: BookStatus;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const update = useUpdateOrderBook(orderId);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={update.isPending}
        className="cursor-pointer disabled:opacity-50"
      >
        <GlowingBadge variant={STATUS_BADGE_VARIANT[currentStatus]}>
          {STATUS_LABELS[currentStatus]}
        </GlowingBadge>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex flex-col gap-1 rounded-lg border bg-popover p-1.5 shadow-md">
          {EVENT_STATUSES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (value !== currentStatus) {
                  update.mutate({ obId, data: { status: value } });
                }
                setOpen(false);
              }}
              disabled={update.isPending}
              className={cn(
                "cursor-pointer rounded-full px-1 py-0.5 transition-opacity hover:opacity-80",
                value !== currentStatus && "opacity-40"
              )}
            >
              <GlowingBadge variant={STATUS_BADGE_VARIANT[value]}>
                {label}
              </GlowingBadge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Column definitions ─────────────────────────────────────────────────────────

const columns: ColumnDef<EventRow>[] = [
  {
    id: "expander",
    header: () => null,
    meta: { className: "w-8" },
    cell: ({ row }) =>
      row.getCanExpand() ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            row.toggleExpanded();
          }}
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {row.getIsExpanded() ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
      ) : (
        <span className="inline-block w-[14px]" />
      ),
  },
  {
    id: "name",
    header: "Book / Customer",
    cell: ({ row }) => {
      const d = row.original;
      if (d._kind === "pub") {
        return (
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {d.publisher_name}
          </span>
        );
      }
      if (d._kind === "book") {
        return (
          <span className={cn(d.is_complete && "text-muted-foreground")}>
            {d.title}
          </span>
        );
      }
      return (
        <div className="pl-1">
          <Link
            href={`/orders/${d.order_id}`}
            className="text-sm font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {d.customer_name}
          </Link>
          <p className="text-xs text-muted-foreground">{d.customer_phone}</p>
        </div>
      );
    },
  },
  {
    id: "qty",
    header: "Qty",
    meta: { className: "w-20" },
    cell: ({ row }) => {
      const d = row.original;
      if (d._kind === "book") {
        return (
          <span
            className={cn("tabular-nums text-sm", d.is_complete && "text-muted-foreground")}
          >
            {d.total_qty}
          </span>
        );
      }
      if (d._kind === "copy" && d.outstanding_amount > 0) {
        return (
          <span className="tabular-nums text-xs text-destructive font-medium">
            RM {d.outstanding_amount.toFixed(2)}
          </span>
        );
      }
      return null;
    },
  },
  {
    id: "status",
    header: "Status",
    meta: { className: "w-48" },
    cell: ({ row }) => {
      const d = row.original;
      if (d._kind === "book") {
        return d.is_complete ? (
          <span className="text-xs text-muted-foreground">All bought</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {d.active_qty} pending
            {d.bought_qty > 0 && `, ${d.bought_qty} bought`}
          </span>
        );
      }
      if (d._kind === "copy") {
        return (
          <CopyStatusBadge
            orderId={d.order_id}
            obId={d.ob_id}
            currentStatus={d.ob_status}
          />
        );
      }
      return null;
    },
  },
];

// ── TanStack helpers ───────────────────────────────────────────────────────────

function getSubRows(row: EventRow): EventRow[] | undefined {
  if (row._kind === "pub") return row.subRows as EventRow[];
  if (row._kind === "book") return row.subRows as EventRow[];
  return undefined;
}

function getRowId(row: EventRow): string {
  if (row._kind === "pub") return `pub_${row.publisher_name}`;
  if (row._kind === "book") return `book_${row.book_id}`;
  return `copy_${row.ob_id}`;
}

function getRowClassName(row: Row<EventRow>): string | undefined {
  const d = row.original;
  if (d._kind === "pub") return "bg-muted/40 hover:bg-muted/40 select-none cursor-pointer";
  if (d._kind === "book") return cn("select-none cursor-pointer", d.is_complete && "opacity-50");
  if (d._kind === "copy") return "bg-muted/10";
  return undefined;
}

// ── Mobile status buttons (segmented control) ─────────────────────────────────

function MobileStatusButtons({
  orderId,
  obId,
  currentStatus,
}: {
  orderId: number;
  obId: number;
  currentStatus: BookStatus;
}) {
  const update = useUpdateOrderBook(orderId);
  return (
    <div className="flex gap-2">
      {EVENT_STATUSES.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => {
            if (o.value !== currentStatus)
              update.mutate({ obId, data: { status: o.value } });
          }}
          disabled={update.isPending}
          className={cn(
            "cursor-pointer rounded-full px-1 py-0.5 transition-opacity hover:opacity-80 disabled:opacity-50",
            o.value !== currentStatus && "opacity-40"
          )}
        >
          <GlowingBadge variant={STATUS_BADGE_VARIANT[o.value]}>
            {STATUS_LABELS[o.value]}
          </GlowingBadge>
        </button>
      ))}
    </div>
  );
}

// ── Mobile view ────────────────────────────────────────────────────────────────

function MobileEventDayView({ rows }: { rows: PubRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6 sm:hidden">
      {rows.map((pub) => (
        <div key={pub.publisher_name}>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {pub.publisher_name}
          </p>
          <div className="space-y-2">
            {pub.subRows.map((book) => {
              const key = `book_${book.book_id}`;
              const isOpen = expanded.has(key);
              return (
                <div
                  key={key}
                  className={cn(
                    "overflow-hidden rounded-lg border",
                    book.is_complete && "opacity-50"
                  )}
                >
                  {/* Book header — tap to expand */}
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{book.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {book.total_qty} {book.total_qty === 1 ? "copy" : "copies"}
                        {book.is_complete
                          ? " · all bought"
                          : ` · ${book.active_qty} pending${book.bought_qty > 0 ? `, ${book.bought_qty} bought` : ""}`}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronDown size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {/* Expanded: one card per order copy */}
                  {isOpen && (
                    <div className="divide-y border-t bg-muted/20">
                      {book.subRows.map((copy) => (
                        <div key={copy.ob_id} className="px-4 py-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/orders/${copy.order_id}`}
                                className="block truncate text-sm font-medium hover:underline"
                              >
                                {copy.customer_name}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {copy.customer_phone}
                              </p>
                            </div>
                            {copy.outstanding_amount > 0 && (
                              <span className="shrink-0 text-sm tabular-nums font-semibold text-destructive">
                                RM {copy.outstanding_amount.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <MobileStatusButtons
                            orderId={copy.order_id}
                            obId={copy.ob_id}
                            currentStatus={copy.ob_status}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EventDayTable({ orders }: { orders: Order[] }) {
  const rows = useMemo(() => buildRows(orders), [orders]);

  // Dashboard shows a loader until orders are ready, so rows is populated on first mount
  const [expanded, setExpanded] = useState<ExpandedState>(() =>
    Object.fromEntries(rows.map((r) => [`pub_${r.publisher_name}`, true]))
  );

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No books pending purchase.
      </p>
    );
  }

  return (
    <>
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={rows as EventRow[]}
          getSubRows={getSubRows}
          getRowId={getRowId}
          expanded={expanded}
          onExpandedChange={setExpanded}
          getRowClassName={getRowClassName}
          onRowClick={(row) => {
            if (row.getCanExpand()) row.toggleExpanded();
          }}
        />
      </div>
      <MobileEventDayView rows={rows} />
    </>
  );
}
