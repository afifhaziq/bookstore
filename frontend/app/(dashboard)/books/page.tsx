"use client";

import { useState } from "react";
import { useBooks, useUpdateBook, useDeleteBook } from "@/hooks/useBooks";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { BookStatus } from "@/lib/api";
import { Trash2 } from "lucide-react";

const BOOK_STATUSES: BookStatus[] = [
  "deposit",
  "paid",
  "bought",
  "under_delivery",
  "delivered",
  "cancelled",
];

export default function BooksPage() {
  const [filterStatus, setFilterStatus] = useState<BookStatus | "all">("all");
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: books, isLoading } = useBooks({
    status: filterStatus === "all" ? undefined : filterStatus,
    outstanding_only: outstandingOnly,
  });

  const deleteBook = useDeleteBook();

  async function handleDelete() {
    if (deleteId == null) return;
    await deleteBook.mutateAsync(deleteId);
    setDeleteId(null);
  }

  return (
    <PageShell title="Books">
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as BookStatus | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {BOOK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <StatusBadge status={s} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setOutstandingOnly((p) => !p)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
            outstandingOnly
              ? "bg-destructive/10 border-destructive text-destructive"
              : "hover:bg-accent"
          }`}
        >
          Outstanding only
        </button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(books ?? []).map((book) => (
              <TableRow key={book.id}>
                <TableCell className="font-medium">{book.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  {book.author ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={book.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {book.price ? `RM ${book.price.total_price.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {book.price
                    ? `RM ${book.price.deposit_amount.toFixed(2)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {book.price && book.price.outstanding_amount > 0 ? (
                    <span className="text-destructive">
                      RM {book.price.outstanding_amount.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(book.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {books?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No books match the current filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this book?</AlertDialogTitle>
            <AlertDialogDescription>
              The book will be permanently removed from the order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
