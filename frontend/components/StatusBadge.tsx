import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  deposit: "bg-yellow-100 text-yellow-800 border-yellow-200",
  paid: "bg-blue-100 text-blue-800 border-blue-200",
  bought: "bg-purple-100 text-purple-800 border-purple-200",
  under_delivery: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  active: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_LABELS: Record<string, string> = {
  deposit: "Deposit",
  paid: "Paid",
  bought: "Bought",
  under_delivery: "Under Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  active: "Active",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
