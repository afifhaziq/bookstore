"use client";

import { useState } from "react";
import { useBooks, useDeleteBook } from "@/hooks/useBooks";
import { PageShell } from "@/components/PageShell";
import { AddBookDialog } from "@/components/AddBookDialog";
import { Button } from "@/components/ui/button";
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
import { Book, PS_CHARGE_RATES } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

const PS_CHARGE_LABELS: Record<string, string> = {
  soft_cover: "Soft Cover",
  hard_cover: "Hard Cover",
  premium:    "Premium",
};

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


export default function BooksPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("all");
  const [psFilter, setPsFilter] = useState("all");

  const { data: books, isLoading } = useBooks();
  const deleteBook = useDeleteBook();

  const publishers = Array.from(new Set((books ?? []).map((b) => b.publisher_name))).sort();

  const filtered = (books ?? []).filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.publisher_name.toLowerCase().includes(search.toLowerCase());
    const matchesPublisher = publisherFilter === "all" || b.publisher_name === publisherFilter;
    const matchesPs = psFilter === "all" || b.ps_charge === psFilter;
    return matchesSearch && matchesPublisher && matchesPs;
  });

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
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Search</span>
          <Input
            placeholder="Search by title or publisher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80 border-foreground/20"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Publisher</span>
          <Select value={publisherFilter} onValueChange={(v) => v && setPublisherFilter(v)}>
            <SelectTrigger className="w-48 border-foreground/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All publishers</SelectItem>
              {publishers.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">PS Charge</span>
          <Select value={psFilter} onValueChange={(v) => v && setPsFilter(v)}>
            <SelectTrigger className="w-40 border-foreground/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="soft_cover">Soft Cover</SelectItem>
              <SelectItem value="hard_cover">Hard Cover</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
              <TableHead>Title</TableHead>
              <TableHead>Publisher</TableHead>
              <TableHead>PS Charge</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onDelete={() => setDeleteId(book.id)}
              />
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  {books?.length === 0 ? "No books found. Add one to get started." : "No books match your filters."}
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
