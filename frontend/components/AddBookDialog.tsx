"use client";

import { useState } from "react";
import { useCreateBook } from "@/hooks/useBooks";
import { usePublishers, useCreatePublisher } from "@/hooks/usePublishers";
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
import { Book, PsChargeType } from "@/lib/api";
import { Plus } from "lucide-react";

const PS_CHARGE_OPTIONS: { value: PsChargeType; label: string }[] = [
  { value: "premium", label: "Premium (RM 10)" },
  { value: "hard_cover", label: "Hard Cover (RM 8)" },
  { value: "soft_cover", label: "Soft Cover (RM 5)" },
];

interface AddBookDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (book: Book) => void;
}

export function AddBookDialog({ open, onClose, onSuccess }: AddBookDialogProps) {
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

    const book = await createBook.mutateAsync({
      title,
      publisher_id: resolvedPublisherId,
      ps_charge: psCharge,
      total_price: totalPrice,
      deposit_amount: depositAmount || "0",
    });
    reset();
    onClose();
    onSuccess?.(book);
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
