import { Badge } from "@/components/ui/badge";

const POSTAGE_STYLES: Record<string, string> = {
  semenanjung: "bg-emerald-100 text-emerald-800 border-emerald-200",
  sabah_sarawak: "bg-violet-100 text-violet-800 border-violet-200",
};

const POSTAGE_LABELS: Record<string, string> = {
  semenanjung: "Semenanjung",
  sabah_sarawak: "Sabah/Sarawak",
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
