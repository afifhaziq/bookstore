"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
        <p className="text-muted-foreground text-sm">Loading…</p>
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
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <StatusBadge status={status} />
              </CardTitle>
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
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              RM {Number(data.total_outstanding).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-sans text-lg font-semibold mb-3">
          Books with Outstanding Balance
        </h2>
        {data.books_with_outstanding.length === 0 ? (
          <p className="text-muted-foreground text-sm">All balances settled.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.books_with_outstanding.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {book.author ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={book.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    RM {book.price ? Number(book.price.outstanding_amount).toFixed(2) : "0.00"}
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
