import { Badge } from "@/components/ui/badge";

const POSTAGE_STYLES: Record<string, string> = {
  premium: "bg-amber-100 text-amber-800 border-amber-200",
  hard_cover: "bg-slate-100 text-slate-700 border-slate-200",
  soft_cover: "bg-sky-100 text-sky-700 border-sky-200",
};

const POSTAGE_LABELS: Record<string, string> = {
  premium: "Premium",
  hard_cover: "Hard Cover",
  soft_cover: "Soft Cover",
};

export function PostageBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <Badge
      variant="outline"
      className={POSTAGE_STYLES[type] ?? "bg-gray-100 text-gray-700"}
    >
      {POSTAGE_LABELS[type] ?? type}
    </Badge>
  );
}
