"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOrder, useCancelOrder, useReactivateOrder, useUpdateOrder, useAddCopiesToOrder, useUpdateOrderBook } from "@/hooks/useOrders";
import { useBooks } from "@/hooks/useBooks";
import { PageShell } from "@/components/PageShell";
import { PriceSummary } from "@/components/PriceSummary";
import { GlowingBadge, type GlowingBadgeVariant } from "@/components/ui/glowing-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, Plus } from "lucide-react";
import { BookStatus, OrderBook, CopySpec, PS_CHARGE_RATES, PostageType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

const BOOK_STATUSES: BookStatus[] = [
  "deposit",
  "paid",
  "bought",
  "under_delivery",
  "delivered",
  "cancelled",
];

const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  deposit:        "Deposit",
  paid:           "Paid",
  bought:         "Bought",
  under_delivery: "Under Delivery",
  delivered:      "Delivered",
  cancelled:      "Cancelled",
};

const BOOK_STATUS_VARIANT: Record<BookStatus, GlowingBadgeVariant> = {
  deposit:        "deposit",
  paid:           "paid",
  bought:         "bought",
  under_delivery: "warning",
  delivered:      "success",
  cancelled:      "neutral",
};

const PS_CHARGE_LABELS: Record<string, string> = {
  soft_cover: "Soft Cover",
  hard_cover: "Hard Cover",
  premium:    "Premium",
};

const PS_CHARGE_VARIANT: Record<string, GlowingBadgeVariant> = {
  premium:    "gold",
  hard_cover: "purple",
  soft_cover: "silver",
};

const ORDER_STATUS_VARIANT: Record<string, GlowingBadgeVariant> = {
  active:    "success",
  cancelled: "neutral",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  active:    "Active",
  cancelled: "Cancelled",
};

const POSTAGE_VARIANT: Record<string, GlowingBadgeVariant> = {
  semenanjung:   "info",
  sabah_sarawak: "warning",
};

const POSTAGE_LABEL: Record<string, string> = {
  semenanjung:   "Semenanjung",
  sabah_sarawak: "Sabah/Sarawak",
};

function OrderBookStatusBadge({
  ob,
  orderId,
}: {
  ob: OrderBook;
  orderId: number;
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

  async function handleSelect(status: BookStatus) {
    if (status === ob.status) { setOpen(false); return; }
    if (status === "paid" && ob.outstanding_amount > 0) return;
    await update.mutateAsync({ obId: ob.id, data: { status } });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={update.isPending}
        className="cursor-pointer disabled:opacity-50"
      >
        <GlowingBadge variant={BOOK_STATUS_VARIANT[ob.status]}>
          {BOOK_STATUS_LABEL[ob.status]}
        </GlowingBadge>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex flex-col gap-1 rounded-lg border bg-popover p-1.5 shadow-md">
          {BOOK_STATUSES.map((s) => {
            const disabled = s === "paid" && ob.outstanding_amount > 0;
            return (
              <div key={s} className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelect(s)}
                  disabled={disabled || update.isPending}
                  className={cn(
                    "cursor-pointer rounded-full px-1 py-0.5 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40",
                    s !== ob.status && "opacity-40"
                  )}
                >
                  <GlowingBadge variant={BOOK_STATUS_VARIANT[s]}>
                    {BOOK_STATUS_LABEL[s]}
                  </GlowingBadge>
                </button>
                {disabled && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    balance due
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderBookStatusMobile({ ob, orderId }: { ob: OrderBook; orderId: number }) {
  const update = useUpdateOrderBook(orderId);

  async function handleSelect(status: BookStatus) {
    if (status === ob.status) return;
    if (status === "paid" && ob.outstanding_amount > 0) return;
    await update.mutateAsync({ obId: ob.id, data: { status } });
  }

  return (
    <div className="flex flex-wrap gap-2 sm:hidden">
      {BOOK_STATUSES.map((s) => {
        const disabled = s === "paid" && ob.outstanding_amount > 0;
        return (
          <button
            key={s}
            type="button"
            onClick={() => handleSelect(s)}
            disabled={disabled || update.isPending}
            className={cn(
              "cursor-pointer rounded-full px-1 py-0.5 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40",
              s !== ob.status && "opacity-40"
            )}
          >
            <GlowingBadge variant={BOOK_STATUS_VARIANT[s]}>
              {BOOK_STATUS_LABEL[s]}
            </GlowingBadge>
          </button>
        );
      })}
    </div>
  );
}

function AddBooksDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { data: allBooks } = useBooks();
  const addCopies = useAddCopiesToOrder(orderId);
  const [steppers, setSteppers] = useState<Record<number, number>>({});

  const books = allBooks ?? [];
  const totalToAdd = Object.values(steppers).reduce((s, n) => s + n, 0);

  function increment(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function decrement(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  function handleClose() {
    setSteppers({});
    onClose();
  }

  async function handleAdd() {
    if (totalToAdd === 0) return;
    const copies: CopySpec[] = Object.entries(steppers)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ book_id: Number(id), quantity: qty }));
    await addCopies.mutateAsync(copies);
    setSteppers({});
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Books to Order</DialogTitle>
        </DialogHeader>

        {books.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No books in catalog. Add books from the Books page first.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {books.map((book) => {
              const count = steppers[book.id] ?? 0;
              return (
                <div
                  key={book.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="font-medium text-sm">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.publisher_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      RM {(Number(book.total_price) + PS_CHARGE_RATES[book.ps_charge]).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => decrement(book.id)}
                      disabled={count === 0}
                    >
                      −
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{count}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => increment(book.id)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={totalToAdd === 0 || addCopies.isPending}>
            {addCopies.isPending
              ? "Adding…"
              : `Add ${totalToAdd > 0 ? totalToAdd : ""} Book${totalToAdd !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkStatusPicker({
  selectedCount,
  onApply,
  isPending,
}: {
  selectedCount: number;
  onApply: (status: BookStatus) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        disabled={selectedCount === 0 || isPending}
      >
        Set status
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex flex-col gap-1 rounded-lg border bg-popover p-1.5 shadow-md">
          {BOOK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onApply(s); setOpen(false); }}
              className="cursor-pointer rounded-full px-1 py-0.5 transition-opacity hover:opacity-80"
            >
              <GlowingBadge variant={BOOK_STATUS_VARIANT[s]}>
                {BOOK_STATUS_LABEL[s]}
              </GlowingBadge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderBookRow({
  ob,
  orderId,
  isActive,
  isSelected,
  onToggle,
}: {
  ob: OrderBook;
  orderId: number;
  isActive: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const updateOrderBook = useUpdateOrderBook(orderId);
  const [editing, setEditing] = useState(false);
  const [deposit, setDeposit] = useState(ob.deposit_amount.toString());

  async function handleDepositSave() {
    await updateOrderBook.mutateAsync({ obId: ob.id, data: { deposit_amount: deposit } });
    setEditing(false);
  }

  async function handlePaidFull() {
    await updateOrderBook.mutateAsync({ obId: ob.id, data: { deposit_amount: ob.total_price.toString() } });
  }

  return (
    <div className="flex flex-col gap-2 py-3 border-b last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isActive && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggle}
              className="dark:border-muted-foreground"
            />
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm">{ob.title}</p>
              <GlowingBadge variant={PS_CHARGE_VARIANT[ob.ps_charge]} dot={false}>
                {PS_CHARGE_LABELS[ob.ps_charge]}
              </GlowingBadge>
            </div>
            <p className="text-xs text-muted-foreground">{ob.publisher_name}</p>
          </div>
        </div>
        <div className="hidden sm:block">
          <OrderBookStatusBadge ob={ob} orderId={orderId} />
        </div>
      </div>

      <OrderBookStatusMobile ob={ob} orderId={orderId} />

      <div className="flex items-end gap-3">
        <PriceSummary
          totalPrice={ob.total_price}
          depositAmount={ob.deposit_amount}
          outstandingAmount={ob.outstanding_amount}
        />
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-7 w-24 text-xs"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={handleDepositSave}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => {
                setDeposit(ob.deposit_amount.toString());
                setEditing(true);
              }}
            >
              Edit deposit
            </Button>
            {ob.outstanding_amount > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs px-2"
                onClick={handlePaidFull}
                disabled={updateOrderBook.isPending}
              >
                Paid full
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: order, isLoading, error } = useOrder(Number(id));
  const cancelOrder = useCancelOrder();
  const reactivateOrder = useReactivateOrder();
  const updateOrder = useUpdateOrder(Number(id));
  const updateOrderBook = useUpdateOrderBook(Number(id));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [addBooksOpen, setAddBooksOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [address, setAddress] = useState("");
  const [editingPostage, setEditingPostage] = useState(false);
  const [postageType, setPostageType] = useState<PostageType | "">("");
  const [postageAmount, setPostageAmount] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  if (isLoading) {
    return (
      <PageShell title="Order">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </PageShell>
    );
  }

  if (error || !order) {
    return (
      <PageShell title="Order">
        <p className="text-destructive text-sm">Order not found.</p>
      </PageShell>
    );
  }

  async function handleCancel() {
    await cancelOrder.mutateAsync(Number(id));
    setCancelOpen(false);
  }

  async function handleReactivate() {
    await reactivateOrder.mutateAsync(Number(id));
    setReactivateOpen(false);
  }

  async function handleAddressSave() {
    await updateOrder.mutateAsync({ address });
    setEditingAddress(false);
  }

  async function handlePostageSave() {
    await updateOrder.mutateAsync({
      postage_type: postageType as PostageType,
      postage_amount: postageAmount,
    });
    setEditingPostage(false);
  }

  async function handlePayAllFull() {
    const outstanding = order!.order_books.filter((ob) => ob.outstanding_amount > 0);
    await Promise.all(
      outstanding.map((ob) =>
        updateOrderBook.mutateAsync({
          obId: ob.id,
          data: {
            deposit_amount: ob.total_price.toString(),
            status: "paid",
          },
        })
      )
    );
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === order!.order_books.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(order!.order_books.map((ob) => ob.id)));
    }
  }

  async function handleBulkApply(status: BookStatus) {
    if (selectedIds.size === 0) return;
    const targets = order!.order_books.filter((ob) => {
      if (!selectedIds.has(ob.id)) return false;
      if (status === "paid" && ob.outstanding_amount > 0) return false;
      return true;
    });
    await Promise.all(
      targets.map((ob) =>
        updateOrderBook.mutateAsync({ obId: ob.id, data: { status } })
      )
    );
    setSelectedIds(new Set());
    setSelectionMode(false);
  }

  function exitSelectionMode() {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }

  return (
    <PageShell
      title={`Order #${order.id}`}
      action={
        <div className="flex items-center gap-2">
          {order.status === "active" && (
            <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
              Cancel order
            </Button>
          )}
          {order.status === "cancelled" && (
            <Button variant="outline" size="sm" onClick={() => setReactivateOpen(true)}>
              Reactivate order
            </Button>
          )}
          <Link href="/orders" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ChevronLeft size={14} />
            Back
          </Link>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <GlowingBadge variant={ORDER_STATUS_VARIANT[order.status]}>
                {ORDER_STATUS_LABEL[order.status]}
              </GlowingBadge>
              {order.postage_type && (
                <GlowingBadge variant={POSTAGE_VARIANT[order.postage_type]}>
                  {POSTAGE_LABEL[order.postage_type]}
                </GlowingBadge>
              )}
            </div>

            <div>
              <p className="text-muted-foreground text-xs mb-1">Address</p>
              {editingAddress ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <Button size="sm" className="h-8" onClick={handleAddressSave}>Save</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingAddress(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p>{order.address}</p>
                  {order.status === "active" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 px-2 text-xs"
                      onClick={() => { setAddress(order.address); setEditingAddress(true); }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>

            {order.note && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Note</p>
                <p>{order.note}</p>
              </div>
            )}

            <div>
              <p className="text-muted-foreground text-xs mb-1">Created</p>
              <p>{new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {(() => {
              const totalBooks = order.order_books.reduce((sum, ob) => sum + (Number(ob.total_price) - PS_CHARGE_RATES[ob.ps_charge]), 0);
              const totalPs = order.order_books.reduce((sum, ob) => sum + PS_CHARGE_RATES[ob.ps_charge], 0);
              const postage = order.postage_amount != null ? Number(order.postage_amount) : 0;
              const grandTotal = totalBooks + totalPs + postage;
              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total book price</span>
                    <span>RM {totalBooks.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total PS charge</span>
                    <span>RM {totalPs.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Postage</span>
                    {editingPostage ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={postageType}
                          onChange={(e) => setPostageType(e.target.value as PostageType)}
                          className="h-7 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="semenanjung">Semenanjung</option>
                          <option value="sabah_sarawak">Sabah/Sarawak</option>
                        </select>
                        <Input
                          className="h-7 w-20 text-xs"
                          value={postageAmount}
                          onChange={(e) => setPostageAmount(e.target.value)}
                          placeholder="Amount"
                        />
                        <Button size="sm" className="h-7 text-xs px-2" onClick={handlePostageSave} disabled={!postageType}>Save</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setEditingPostage(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>
                          {order.postage_type
                            ? `${order.postage_type === "semenanjung" ? "Semenanjung" : "Sabah/Sarawak"} — RM ${Number(order.postage_amount).toFixed(2)}`
                            : "—"}
                        </span>
                        {order.postage_type && order.postage_paid && (
                          <span className="text-xs text-primary font-medium">Paid</span>
                        )}
                        {order.status === "active" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                setPostageType(order.postage_type ?? "semenanjung");
                                setPostageAmount(order.postage_amount?.toString() ?? "");
                                setEditingPostage(true);
                              }}
                            >
                              Edit
                            </Button>
                            {order.postage_type && !order.postage_paid && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 px-2 text-xs"
                                onClick={() => updateOrder.mutateAsync({ postage_paid: true })}
                                disabled={updateOrder.isPending}
                              >
                                Paid
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total</span>
                    <span>RM {grandTotal.toFixed(2)}</span>
                  </div>
                  {(() => {
                    const postageOutstanding = (order.postage_type && !order.postage_paid)
                      ? Number(order.postage_amount ?? 0)
                      : 0;
                    const totalOutstanding = Number(order.total_outstanding) + postageOutstanding;
                    return (
                      <div className="flex justify-between font-medium">
                        <span>Total outstanding</span>
                        <span className={totalOutstanding > 0 ? "text-destructive" : "text-primary"}>
                          RM {totalOutstanding.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          {selectionMode ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select books"}
                </span>
                {selectedIds.size < order.order_books.length && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    · Select all
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    · Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <BulkStatusPicker
                  selectedCount={selectedIds.size}
                  onApply={handleBulkApply}
                  isPending={updateOrderBook.isPending}
                />
                <Button size="sm" variant="ghost" onClick={exitSelectionMode}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">
                Books ({order.order_books.length})
              </h2>
              {order.status === "active" && (
                <div className="flex items-center gap-2">
                  {order.order_books.some((ob) => ob.outstanding_amount > 0) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handlePayAllFull}
                      disabled={updateOrderBook.isPending}
                    >
                      Paid full — all
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setAddBooksOpen(true)}>
                    <Plus size={14} className="mr-1" />
                    Add Books
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectionMode(true)}>
                    Set status
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <Card>
          <CardContent className="pt-4">
            {[...order.order_books].sort((a, b) => a.id - b.id).map((ob) => (
              <OrderBookRow
                key={ob.id}
                ob={ob}
                orderId={Number(id)}
                isActive={order.status === "active" && selectionMode}
                isSelected={selectedIds.has(ob.id)}
                onToggle={() => toggleSelect(ob.id)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <AddBooksDialog
        orderId={Number(id)}
        open={addBooksOpen}
        onClose={() => setAddBooksOpen(false)}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{order.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order and all its book copies as cancelled. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate order #{order.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              The order will become active again and all book copies will be reset to &quot;Deposit&quot; status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep cancelled</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate}>
              Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
