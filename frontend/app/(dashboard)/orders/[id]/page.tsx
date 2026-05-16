"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useOrder, useCancelOrder, useUpdateOrder, useAddCopiesToOrder, useUpdateOrderBook } from "@/hooks/useOrders";
import { useBooks } from "@/hooks/useBooks";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { PostageBadge } from "@/components/PostageBadge";
import { PriceSummary } from "@/components/PriceSummary";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { BookStatus, OrderBook, CopySpec } from "@/lib/api";

const BOOK_STATUSES: BookStatus[] = [
  "deposit",
  "paid",
  "bought",
  "under_delivery",
  "delivered",
  "cancelled",
];

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
                      RM {Number(book.total_price).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => decrement(book.id)}
                      disabled={count === 0}
                      className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium disabled:opacity-30 hover:bg-accent transition-colors"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">{count}</span>
                    <button
                      type="button"
                      onClick={() => increment(book.id)}
                      className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium hover:bg-accent transition-colors"
                    >
                      +
                    </button>
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

function OrderBookRow({ ob, orderId }: { ob: OrderBook; orderId: number }) {
  const updateOrderBook = useUpdateOrderBook(orderId);
  const [editing, setEditing] = useState(false);
  const [deposit, setDeposit] = useState(ob.deposit_amount.toString());

  async function handleStatusChange(status: BookStatus) {
    if (status === "paid" && ob.outstanding_amount > 0) return;
    await updateOrderBook.mutateAsync({ obId: ob.id, data: { status } });
  }

  async function handleDepositSave() {
    await updateOrderBook.mutateAsync({ obId: ob.id, data: { deposit_amount: deposit } });
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2 py-3 border-b last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{ob.title}</p>
          <p className="text-xs text-muted-foreground">{ob.publisher_name}</p>
        </div>
        <Select value={ob.status} onValueChange={(v) => v && handleStatusChange(v as BookStatus)}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOK_STATUSES.map((s) => {
              const disabled = s === "paid" && ob.outstanding_amount > 0;
              return (
                <SelectItem key={s} value={s} className="text-xs" disabled={disabled}>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s} />
                    {disabled && (
                      <span className="text-muted-foreground text-xs">(clear balance first)</span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end gap-3 text-xs">
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
  const updateOrder = useUpdateOrder(Number(id));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [addBooksOpen, setAddBooksOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [address, setAddress] = useState("");
  const [editingPostage, setEditingPostage] = useState(false);
  const [postageAmount, setPostageAmount] = useState("");

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

  async function handleAddressSave() {
    await updateOrder.mutateAsync({ address });
    setEditingAddress(false);
  }

  async function handlePostageSave() {
    await updateOrder.mutateAsync({ postage_amount: postageAmount });
    setEditingPostage(false);
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
              <StatusBadge status={order.status} />
              {order.postage_type && <PostageBadge type={order.postage_type} />}
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
                      variant="ghost"
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
            {order.postage_type && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Postage ({order.postage_type === "semenanjung" ? "Semenanjung" : "Sabah/Sarawak"})
                </span>
                {editingPostage ? (
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 w-24 text-xs"
                      value={postageAmount}
                      onChange={(e) => setPostageAmount(e.target.value)}
                    />
                    <Button size="sm" className="h-7 text-xs px-2" onClick={handlePostageSave}>Save</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setEditingPostage(false)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>
                      {order.postage_amount != null
                        ? `RM ${Number(order.postage_amount).toFixed(2)}`
                        : "—"}
                    </span>
                    {order.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setPostageAmount(order.postage_amount?.toString() ?? "");
                          setEditingPostage(true);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total outstanding</span>
              <span className={order.total_outstanding > 0 ? "text-destructive" : "text-green-700"}>
                RM {Number(order.total_outstanding).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-sans text-lg font-semibold">
            Books ({order.order_books.length})
          </h2>
          {order.status === "active" && (
            <Button size="sm" variant="outline" onClick={() => setAddBooksOpen(true)}>
              <Plus size={14} className="mr-1" />
              Add Books
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="pt-4">
            {order.order_books.map((ob) => (
              <OrderBookRow key={ob.id} ob={ob} orderId={Number(id)} />
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
    </PageShell>
  );
}
