"use client";

import { use } from "react";
import Link from "next/link";
import { useCustomer } from "@/hooks/useCustomers";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { PostageBadge } from "@/components/PostageBadge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: customer, isLoading, error } = useCustomer(Number(id));

  if (isLoading) {
    return (
      <PageShell title="Customer">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </PageShell>
    );
  }

  if (error || !customer) {
    return (
      <PageShell title="Customer">
        <p className="text-destructive text-sm">Customer not found.</p>
      </PageShell>
    );
  }

  const activeOrders = customer.orders.filter((o) => o.status === "active");
  const cancelledOrders = customer.orders.filter((o) => o.status === "cancelled");

  return (
    <PageShell
      title={customer.name}
      action={
        <Link href="/customers" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ChevronLeft size={14} />
          Back
        </Link>
      }
    >
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          <span className="font-medium text-foreground">Phone:</span>{" "}
          {customer.phone_number}
        </p>
        <p>
          <span className="font-medium text-foreground">Member since:</span>{" "}
          {new Date(customer.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold">
          Orders ({customer.orders.length})
        </h2>

        {customer.orders.length === 0 && (
          <p className="text-muted-foreground text-sm">No orders yet.</p>
        )}

        {[...activeOrders, ...cancelledOrders].map((order) => (
          <Card key={order.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <Link
                  href={`/orders/${order.id}`}
                  className="hover:underline"
                >
                  Order #{order.id}
                </Link>
                <div className="flex items-center gap-2">
                  <StatusBadge status={order.status} />
                  {order.postage_type && (
                    <PostageBadge type={order.postage_type} />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{order.address}</p>
              <div className="text-sm space-y-1">
                {order.books.map((book) => (
                  <div key={book.id} className="flex items-center justify-between">
                    <span>{book.title}</span>
                    <StatusBadge status={book.status} />
                  </div>
                ))}
              </div>
              {order.total_outstanding > 0 && (
                <p className="text-sm font-medium text-destructive">
                  Outstanding: RM {order.total_outstanding.toFixed(2)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
