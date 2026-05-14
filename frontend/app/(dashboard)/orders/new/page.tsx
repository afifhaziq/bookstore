"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import { useCreateOrder } from "@/hooks/useOrders";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PostageType, BookStatus } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

interface BookDraft {
  title: string;
  author: string;
  status: BookStatus;
  total_price: string;
  deposit_amount: string;
}

const POSTAGE_OPTIONS: { value: PostageType; label: string }[] = [
  { value: "premium", label: "Premium (RM 10)" },
  { value: "hard_cover", label: "Hard Cover (RM 8)" },
  { value: "soft_cover", label: "Soft Cover (RM 5)" },
];

const BOOK_STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: "deposit", label: "Deposit" },
  { value: "paid", label: "Paid" },
  { value: "bought", label: "Bought" },
  { value: "under_delivery", label: "Under Delivery" },
  { value: "delivered", label: "Delivered" },
];

function emptyBook(): BookDraft {
  return {
    title: "",
    author: "",
    status: "deposit",
    total_price: "",
    deposit_amount: "",
  };
}

export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — customer
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const { data: customers } = useCustomers(customerSearch || undefined);

  // Step 2 — books
  const [books, setBooks] = useState<BookDraft[]>([emptyBook()]);

  // Step 3 — delivery
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [postageType, setPostageType] = useState<PostageType | "">("");

  const createOrder = useCreateOrder();

  function addBook() {
    setBooks((prev) => [...prev, emptyBook()]);
  }

  function removeBook(i: number) {
    setBooks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateBook(i: number, patch: Partial<BookDraft>) {
    setBooks((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b))
    );
  }

  async function handleSubmit() {
    if (!customerId) return;
    const order = await createOrder.mutateAsync({
      user_id: customerId,
      address,
      note: note || undefined,
      postage_type: postageType || undefined,
      books: books.map((b) => ({
        title: b.title,
        author: b.author || undefined,
        status: b.status,
        price: {
          total_price: b.total_price,
          deposit_amount: b.deposit_amount || "0",
        },
      })),
    });
    router.push(`/orders/${order.id}`);
  }

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  return (
    <PageShell title="New Order">
      {/* Step indicators */}
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
              <span
                className={
                  active ? "font-medium" : "text-muted-foreground"
                }
              >
                {label}
              </span>
              {i < 2 && (
                <span className="text-muted-foreground mx-1">→</span>
              )}
            </span>
          );
        })}
      </div>

      {/* Step 1: Customer */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-medium">Select a customer</h2>
          <Input
            placeholder="Search by name or phone…"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(customers ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCustomerId(c.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  customerId === c.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent"
                }`}
              >
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.phone_number}
                </p>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!customerId}
            >
              Next: Books
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Books */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-medium">
            Books for {selectedCustomer?.name}
          </h2>

          <div className="space-y-4">
            {books.map((book, i) => (
              <Card key={i}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Book {i + 1}</span>
                    {books.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeBook(i)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Title *</label>
                      <Input
                        required
                        value={book.title}
                        onChange={(e) =>
                          updateBook(i, { title: e.target.value })
                        }
                        placeholder="Book title"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Author</label>
                      <Input
                        value={book.author}
                        onChange={(e) =>
                          updateBook(i, { author: e.target.value })
                        }
                        placeholder="Author name"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Status</label>
                      <Select
                        value={book.status}
                        onValueChange={(v) =>
                          updateBook(i, { status: v as BookStatus })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOK_STATUS_OPTIONS.map((s) => (
                            <SelectItem
                              key={s.value}
                              value={s.value}
                              className="text-sm"
                            >
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        Total price (RM) *
                      </label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        value={book.total_price}
                        onChange={(e) =>
                          updateBook(i, { total_price: e.target.value })
                        }
                        placeholder="0.00"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        Deposit paid (RM)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={book.deposit_amount}
                        onChange={(e) =>
                          updateBook(i, { deposit_amount: e.target.value })
                        }
                        placeholder="0.00"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addBook}>
            <Plus size={14} className="mr-1" />
            Add book
          </Button>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={books.some((b) => !b.title || !b.total_price)}
            >
              Next: Delivery
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Delivery */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-medium">Delivery details</h2>

          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <label className="text-sm font-medium">Address *</label>
              <Textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full delivery address"
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Note</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any special instructions…"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Postage type</label>
              <Select
                value={postageType}
                onValueChange={(v) => setPostageType(v as PostageType)}
              >
                <SelectTrigger>
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
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!address || createOrder.isPending}
            >
              {createOrder.isPending ? "Creating…" : "Create order"}
            </Button>
          </div>

          {createOrder.isError && (
            <p className="text-destructive text-sm">
              Failed to create order. Please try again.
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
