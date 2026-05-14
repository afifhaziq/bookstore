"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useOrder, useCancelOrder, useUpdateOrder } from "@/hooks/useOrders";
import { useUpdateBook } from "@/hooks/useBooks";
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
import { ChevronLeft } from "lucide-react";
import { BookStatus } from "@/lib/api";

const BOOK_STATUSES: BookStatus[] = [
  "deposit",
  "paid",
  "bought",
  "under_delivery",
  "delivered",
  "cancelled",
];

function BookRow({ book }: { book: { id: number; title: string; author: string | null; status: BookStatus; price: { total_price: number; deposit_amount: number; outstanding_amount: number } | null } }) {
  const updateBook = useUpdateBook(book.id);
  const [editing, setEditing] = useState(false);
  const [deposit, setDeposit] = useState(
    book.price?.deposit_amount.toString() ?? "0"
  );

  async function handleStatusChange(status: BookStatus) {
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
            {BOOK_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                <StatusBadge status={s} />
              </SelectItem>
            ))}
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
                <span>RM {order.postage_charge.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total outstanding</span>
              <span
                className={
                  order.total_outstanding > 0 ? "text-destructive" : "text-green-700"
                }
              >
                RM {order.total_outstanding.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-serif text-lg font-semibold mb-3">
          Books ({order.books.length})
        </h2>
        <Card>
          <CardContent className="pt-4">
            {order.books.map((book) => (
              <BookRow key={book.id} book={book} />
            ))}
          </CardContent>
        </Card>
      </div>

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
