"use client";

import { useState } from "react";
import Link from "next/link";
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@/hooks/useCustomers";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Check, X, Trash2, Copy } from "lucide-react";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultAddress, setDefaultAddress] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: customers, isLoading } = useCustomers(search || undefined);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createCustomer.mutateAsync({ name, phone_number: phone, default_address: defaultAddress || undefined });
    setName("");
    setPhone("");
    setDefaultAddress("");
    setOpen(false);
  }

  function startEdit(id: number, currentName: string, currentPhone: string, currentAddress: string | null) {
    setEditingId(id);
    setEditName(currentName);
    setEditPhone(currentPhone);
    setEditAddress(currentAddress ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleCopy(id: number, name: string, phone: string, address: string | null) {
    const lines = [name, phone, ...(address ? [address] : [])];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function saveEdit(id: number) {
    await updateCustomer.mutateAsync({
      id,
      name: editName,
      phone_number: editPhone,
      default_address: editAddress || undefined,
    });
    setEditingId(null);
  }

  return (
    <PageShell
      title="Customers"
      action={
        <Button onClick={() => setOpen(true)} size="sm">
          Add customer
        </Button>
      }
    >
      <Input
        placeholder="Search by name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm border-foreground/20"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Default address</TableHead>
              <TableHead>Member since</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(customers ?? []).map((c) => {
              const isEditing = editingId === c.id;
              return (
                <TableRow key={c.id} className={isEditing ? "align-top" : ""}>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 w-40"
                        autoFocus
                      />
                    ) : (
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {isEditing ? (
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="h-7 w-36"
                      />
                    ) : (
                      c.phone_number
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs">
                    {isEditing ? (
                      <Textarea
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="Default delivery address…"
                        rows={2}
                        className="min-h-0 w-64 text-sm"
                      />
                    ) : (
                      <span className="whitespace-pre-line text-sm">
                        {c.default_address ?? <span className="italic opacity-40">—</span>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => saveEdit(c.id)}
                          disabled={updateCustomer.isPending}
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={cancelEdit}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopy(c.id, c.name, c.phone_number, c.default_address)}
                          title="Copy info"
                        >
                          {copiedId === c.id ? <Check size={14} /> : <Copy size={14} />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(c.id, c.name, c.phone_number, c.default_address)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {customers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No customers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01x-xxxxxxxx"
              />
            </div>
            <div className="space-y-1">
              <Label>Default address</Label>
              <Textarea
                value={defaultAddress}
                onChange={(e) => setDefaultAddress(e.target.value)}
                placeholder="Default delivery address…"
                rows={3}
                className="border-foreground/20"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the customer and all their orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { await deleteCustomer.mutateAsync(deleteId!); setDeleteId(null); }}
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
