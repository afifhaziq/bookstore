"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { useOrders } from "@/hooks/useOrders";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
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
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
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

  return (
    <PageShell title="Dashboard">
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
