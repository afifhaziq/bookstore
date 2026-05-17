"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <PageShell title="Dashboard">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
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

  const statusMap = Object.fromEntries(
    data.book_status_counts.map((s) => [s.status, s.count])
  );

  return (
    <PageShell title="Dashboard">
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

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Copies with Outstanding Balance
        </h2>
        {data.copies_with_outstanding.length === 0 ? (
          <p className="text-muted-foreground text-sm">All balances settled.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Publisher</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.copies_with_outstanding.map((ob) => (
                <TableRow key={ob.id}>
                  <TableCell className="font-medium">{ob.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {ob.publisher_name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ob.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    RM {Number(ob.outstanding_amount).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </PageShell>
  );
}
