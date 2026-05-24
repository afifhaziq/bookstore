"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { useOrders } from "@/hooks/useOrders";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { EventDayTable } from "./event-day-table";
import { PackagingTable } from "./packaging-table";

export default function DashboardPage() {
  const { data, isLoading: dashLoading, error } = useDashboard();
  const { data: orders, isLoading: ordersLoading } = useOrders();

  const isLoading = dashLoading || ordersLoading;

  if (isLoading) {
    return (
      <PageShell title="Dashboard">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="Dashboard">
        <p className="text-destructive text-sm">Failed to load dashboard.</p>
      </PageShell>
    );
  }

  const statusMap = Object.fromEntries(
    data.book_status_counts.map((s) => [s.status, s.count])
  );

  return (
    <PageShell title="Dashboard">
      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            "deposit",
            "paid",
            "bought",
            "under_delivery",
            "delivered",
            "cancelled",
          ] as const
        ).map((status) => (
          <Card key={status}>
            <CardHeader className="pb-1">
              <StatusBadge status={status} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {statusMap[status] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}

        <Card className="sm:col-span-4 md:col-span-2">
          <CardHeader className="pb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Outstanding
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              RM {Number(data.total_outstanding).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed views */}
      <TabsRoot defaultValue="event-day">
        <TabsList>
          <TabsTrigger value="event-day">Event Day</TabsTrigger>
          <TabsTrigger value="packaging">Packaging &amp; Shipping</TabsTrigger>
        </TabsList>

        <TabsContent value="event-day">
          <EventDayTable orders={orders ?? []} />
        </TabsContent>

        <TabsContent value="packaging">
          <PackagingTable orders={orders ?? []} />
        </TabsContent>
      </TabsRoot>
    </PageShell>
  );
}
