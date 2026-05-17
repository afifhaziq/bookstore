"use client";

import { useState } from "react";
import { useBooks, useCreateBook, useDeleteBook } from "@/hooks/useBooks";
import { usePublishers, useCreatePublisher } from "@/hooks/usePublishers";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Book, PsChargeType, PS_CHARGE_RATES } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";

const PS_CHARGE_OPTIONS: { value: PsChargeType; label: string }[] = [
  { value: "premium", label: "Premium (RM 10)" },
  { value: "hard_cover", label: "Hard Cover (RM 8)" },
  { value: "soft_cover", label: "Soft Cover (RM 5)" },
];

function BookRow({ book, onDelete }: { book: Book; onDelete: () => void }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{book.title}</TableCell>
      <TableCell className="text-muted-foreground">{book.publisher_name}</TableCell>
      <TableCell className="text-muted-foreground capitalize">
        {book.ps_charge.replace("_", " ")}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        RM {(Number(book.total_price) + PS_CHARGE_RATES[book.ps_charge]).toFixed(2)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        RM {Number(book.deposit_amount).toFixed(2)}
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddBookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createBook = useCreateBook();
  const createPublisher = useCreatePublisher();
  const { data: publishers } = usePublishers();

  const [title, setTitle] = useState("");
  const [publisherId, setPublisherId] = useState<string>("");
  const [newPublisherName, setNewPublisherName] = useState("");
  const [showNewPublisher, setShowNewPublisher] = useState(false);
  const [psCharge, setPsCharge] = useState<PsChargeType | "">("");
  const [totalPrice, setTotalPrice] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  function reset() {
    setTitle("");
    setPublisherId("");
    setNewPublisherName("");
    setShowNewPublisher(false);
    setPsCharge("");
    setTotalPrice("");
    setDepositAmount("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let resolvedPublisherId = Number(publisherId);

    if (showNewPublisher && newPublisherName.trim()) {
      const pub = await createPublisher.mutateAsync({ name: newPublisherName.trim() });
      resolvedPublisherId = pub.id;
    }

    if (!resolvedPublisherId || !psCharge) return;

    await createBook.mutateAsync({
      title,
      publisher_id: resolvedPublisherId,
      ps_charge: psCharge,
      total_price: totalPrice,
      deposit_amount: depositAmount || "0",
    });
    reset();
    onClose();
  }

  const isPending = createBook.isPending || createPublisher.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
            />
          </div>

          <div className="space-y-1">
            <Label>Publisher *</Label>
            {showNewPublisher ? (
              <div className="flex gap-2">
                <Input
                  value={newPublisherName}
                  onChange={(e) => setNewPublisherName(e.target.value)}
                  placeholder="New publisher name"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPublisher(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={publisherId} onValueChange={(v) => v && setPublisherId(v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select publisher…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(publishers ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPublisher(true)}
                >
                  <Plus size={14} />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>PS Charge *</Label>
            <Select value={psCharge} onValueChange={(v) => v && setPsCharge(v as PsChargeType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select PS charge type…" />
              </SelectTrigger>
              <SelectContent>
                {PS_CHARGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Total price (RM) *</Label>
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Deposit paid (RM)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add Book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BooksPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: books, isLoading } = useBooks();
  const deleteBook = useDeleteBook();

  async function handleDelete() {
    if (deleteId == null) return;
    await deleteBook.mutateAsync(deleteId);
    setDeleteId(null);
  }

  return (
    <PageShell
      title="Books"
      action={
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1" />
          Add Book
        </Button>
      }
    >
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
              <TableHead>Title</TableHead>
              <TableHead>Publisher</TableHead>
              <TableHead>PS Charge</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(books ?? []).map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onDelete={() => setDeleteId(book.id)}
              />
            ))}
            {books?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No books found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <AddBookDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this book?</AlertDialogTitle>
            <AlertDialogDescription>
              The book will be permanently removed from the catalog.
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
