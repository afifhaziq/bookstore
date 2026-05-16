"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useOrder, useCancelOrder, useUpdateOrder, useAddBooksToOrder } from "@/hooks/useOrders";
import { useUpdateBook, useBooks } from "@/hooks/useBooks";
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
import { Label } from "@/components/ui/label";
import { BookStatus } from "@/lib/api";

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
  existingBookIds,
  open,
  onClose,
}: {
  orderId: number;
  existingBookIds: number[];
  open: boolean;
  onClose: () => void;
}) {
  const { data: allBooks } = useBooks();
  const addBooks = useAddBooksToOrder(orderId);

  const [tab, setTab] = useState<"existing" | "new">("existing");

  // existing-tab state: how many copies to add per book
  const [steppers, setSteppers] = useState<Record<number, number>>({});

  // new-tab state
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [quantity, setQuantity] = useState(1);

  const books = allBooks ?? [];
  const totalToAdd = Object.values(steppers).reduce((s, n) => s + n, 0);

  function increment(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function decrement(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  function resetForm() {
    setSteppers({});
    setTitle("");
    setAuthor("");
    setTotalPrice("");
    setDeposit("0");
    setQuantity(1);
    setTab("existing");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleAddExisting() {
    if (totalToAdd === 0) return;
    const bookIdsToAdd: number[] = [];
    const newBookSpecs: { title: string; author?: string; total_price: string; deposit_amount: string; quantity: number }[] = [];

    for (const [idStr, delta] of Object.entries(steppers)) {
      if (delta === 0) continue;
      const bookId = Number(idStr);
      const book = books.find((b) => b.id === bookId);
      if (!book?.price) continue;
      const inOrder = existingBookIds.includes(bookId);
      if (!inOrder) {
        bookIdsToAdd.push(bookId);
        if (delta > 1) {
          newBookSpecs.push({
            title: book.title,
            author: book.author ?? undefined,
            total_price: String(book.price.total_price),
            deposit_amount: String(book.price.deposit_amount),
            quantity: delta - 1,
          });
        }
      } else {
        newBookSpecs.push({
          title: book.title,
          author: book.author ?? undefined,
          total_price: String(book.price.total_price),
          deposit_amount: String(book.price.deposit_amount),
          quantity: delta,
        });
      }
    }

    await addBooks.mutateAsync({ book_ids: bookIdsToAdd, new_books: newBookSpecs });
    resetForm();
    onClose();
  }

  async function handleAddNew() {
    if (!title.trim() || !totalPrice.trim()) return;
    await addBooks.mutateAsync({
      new_books: [
        {
          title: title.trim(),
          author: author.trim() || undefined,
          total_price: totalPrice,
          deposit_amount: deposit,
          quantity,
        },
      ],
    });
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Books to Order</DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "existing"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Select existing
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "new"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Add new
          </button>
        </div>

        {tab === "existing" ? (
          books.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No books found. Add books from the Books page first.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {books.map((book) => {
                const count = steppers[book.id] ?? 0;
                const inOrder = existingBookIds.includes(book.id);
                return (
                  <div
                    key={book.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{book.title}</p>
                        {inOrder && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            in order
                          </span>
                        )}
                      </div>
                      {book.author && (
                        <p className="text-xs text-muted-foreground">{book.author}</p>
                      )}
                      {book.price && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          RM {Number(book.price.total_price).toFixed(2)}
                        </p>
                      )}
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
          )
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-title">Title *</Label>
              <Input
                id="new-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book title"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-author">Author</Label>
              <Input
                id="new-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-price">Total price (RM) *</Label>
                <Input
                  id="new-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-deposit">Deposit (RM)</Label>
                <Input
                  id="new-deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-qty">Quantity</Label>
              <Input
                id="new-qty"
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.min(50, Math.max(1, Number(e.target.value))))
                }
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {tab === "existing" ? (
            <Button
              onClick={handleAddExisting}
              disabled={totalToAdd === 0 || addBooks.isPending}
            >
              {addBooks.isPending
                ? "Adding…"
                : `Add ${totalToAdd > 0 ? totalToAdd : ""} Book${totalToAdd !== 1 ? "s" : ""}`}
            </Button>
          ) : (
            <Button
              onClick={handleAddNew}
              disabled={!title.trim() || !totalPrice.trim() || addBooks.isPending}
            >
              {addBooks.isPending
                ? "Adding…"
                : `Add ${quantity > 1 ? `${quantity} ` : ""}Book${quantity !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookRow({ book }: { book: { id: number; title: string; author: string | null; status: BookStatus; price: { total_price: number; deposit_amount: number; outstanding_amount: number } | null } }) {
  const updateBook = useUpdateBook(book.id);
  const [editing, setEditing] = useState(false);
  const [deposit, setDeposit] = useState(
    book.price?.deposit_amount.toString() ?? "0"
  );

  const outstanding = Number(book.price?.outstanding_amount ?? 0);

  async function handleStatusChange(status: BookStatus) {
    if (status === "paid" && outstanding > 0) return;
    await updateBook.mutateAsync({ status });
  }

  async function handleDepositSave() {
    await updateBook.mutateAsync({ deposit_amount: deposit });
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2 py-3 border-b last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{book.title}</p>
          {book.author && (
            <p className="text-xs text-muted-foreground">{book.author}</p>
          )}
        </div>
        <Select value={book.status} onValueChange={(v) => v && handleStatusChange(v as BookStatus)}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOK_STATUSES.map((s) => {
              const disabled = s === "paid" && outstanding > 0;
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

      {book.price && (
        <div className="flex items-end gap-3 text-xs">
          <PriceSummary
            totalPrice={book.price.total_price}
            depositAmount={book.price.deposit_amount}
            outstandingAmount={book.price.outstanding_amount}
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
              onClick={() => setEditing(true)}
            >
              Edit deposit
            </Button>
          )}
        </div>
      )}
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

  return (
    <PageShell
      title={`Order #${order.id}`}
      action={
        <div className="flex items-center gap-2">
          {order.status === "active" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setCancelOpen(true)}
            >
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
                  <Button size="sm" className="h-8" onClick={handleAddressSave}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => setEditingAddress(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p>{order.address}</p>
                  {order.status === "active" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setAddress(order.address);
                        setEditingAddress(true);
                      }}
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
            {order.postage_charge != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Postage</span>
                <span>RM {Number(order.postage_charge).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total outstanding</span>
              <span
                className={
                  order.total_outstanding > 0 ? "text-destructive" : "text-green-700"
                }
              >
                RM {Number(order.total_outstanding).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-sans text-lg font-semibold">
            Books ({order.books.length})
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
            {order.books.map((book) => (
              <BookRow key={book.id} book={book} />
            ))}
          </CardContent>
        </Card>
      </div>

      <AddBooksDialog
        orderId={Number(id)}
        existingBookIds={order.books.map((b) => b.id)}
        open={addBooksOpen}
        onClose={() => setAddBooksOpen(false)}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{order.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order and all its books as cancelled. This
              cannot be undone.
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
