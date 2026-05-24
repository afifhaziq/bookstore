"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import { useCreateOrder } from "@/hooks/useOrders";
import { useBooks } from "@/hooks/useBooks";
import { PageShell } from "@/components/PageShell";
import { AddBookDialog } from "@/components/AddBookDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PostageType, PS_CHARGE_RATES, Book } from "@/lib/api";
import { Plus } from "lucide-react";

const POSTAGE_OPTIONS: { value: PostageType; label: string }[] = [
  { value: "semenanjung", label: "Semenanjung (RM 8)" },
  { value: "sabah_sarawak", label: "Sabah / Sarawak (RM 16)" },
];

export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const { data: customers } = useCustomers(customerSearch || undefined);

  const [steppers, setSteppers] = useState<Record<number, number>>({});
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const { data: availableBooks } = useBooks();

  const filteredBooks = (availableBooks ?? []).filter(
    (b) =>
      b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.publisher_name.toLowerCase().includes(bookSearch.toLowerCase())
  );

  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [postageType, setPostageType] = useState<PostageType | "">("");

  const createOrder = useCreateOrder();

  function increment(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function decrement(id: number) {
    setSteppers((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  const totalSelected = Object.values(steppers).reduce((s, n) => s + n, 0);

  async function handleSubmit() {
    if (!customerId || totalSelected === 0) return;
    const copies = Object.entries(steppers)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ book_id: Number(id), quantity: qty }));
    const order = await createOrder.mutateAsync({
      user_id: customerId,
      address,
      note: note || undefined,
      postage_type: postageType || undefined,
      copies,
    });
    router.push(`/orders/${order.id}`);
  }

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  return (
    <PageShell title="New Order">
      <div className="flex items-center gap-2 text-sm">
        {["Customer", "Books", "Delivery"].map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <span key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "border-2 border-primary text-primary"
                    : "border text-muted-foreground"
                }`}
              >
                {n}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>
                {label}
              </span>
              {i < 2 && <span className="text-muted-foreground mx-1">→</span>}
            </span>
          );
        })}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-medium">Select a customer</h2>
          <Input
            placeholder="Search by name or phone…"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="space-y-2">
            {(customers ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCustomerId(c.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  customerId === c.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
              >
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone_number}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!customerId}>
              Next: Books
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Select books for {selectedCustomer?.name}</h2>
            <Button size="sm" variant="outline" onClick={() => setAddBookOpen(true)}>
              <Plus size={14} className="mr-1" />
              New book
            </Button>
          </div>
          <Input
            placeholder="Search by title or publisher…"
            value={bookSearch}
            onChange={(e) => setBookSearch(e.target.value)}
            className="max-w-sm"
          />
          {!availableBooks || availableBooks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No books in catalog. Add books on the Books page first.
              </p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No books match your search.</p>
          ) : (
            <div className="space-y-2">
              {filteredBooks.map((book) => {
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
          {totalSelected > 0 && (
            <p className="text-sm text-muted-foreground">
              {totalSelected} cop{totalSelected !== 1 ? "ies" : "y"} selected
            </p>
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={totalSelected === 0}>
              Next: Delivery
            </Button>
          </div>

          <AddBookDialog
            open={addBookOpen}
            onClose={() => setAddBookOpen(false)}
            onSuccess={(book: Book) =>
              setSteppers((prev) => ({ ...prev, [book.id]: (prev[book.id] ?? 0) + 1 }))
            }
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-medium">Delivery details</h2>
          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <Label>Address *</Label>
              <Textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full delivery address"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any special instructions…"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Postage type</Label>
              <Select
                value={postageType}
                onValueChange={(v) => v && setPostageType(v as PostageType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select postage…" />
                </SelectTrigger>
                <SelectContent>
                  {POSTAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button
              onClick={handleSubmit}
              disabled={!address || createOrder.isPending}
            >
              {createOrder.isPending ? "Creating…" : "Create order"}
            </Button>
          </div>
          {createOrder.isError && (
            <p className="text-destructive text-sm">Failed to create order. Please try again.</p>
          )}
        </div>
      )}
    </PageShell>
  );
}
