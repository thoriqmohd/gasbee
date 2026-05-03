import { Badge } from "@/components/ui/badge";

const colors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-900",
  accepted: "bg-blue-100 text-blue-900",
  rejected: "bg-red-100 text-red-900",
  active: "bg-green-100 text-green-900",
  suspended: "bg-red-100 text-red-900",
  approved: "bg-green-100 text-green-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
  failed: "bg-red-100 text-red-900",
  paid: "bg-green-100 text-green-900",
  online: "bg-green-100 text-green-900",
  offline: "bg-gray-100 text-gray-900",
  busy: "bg-yellow-100 text-yellow-900",
  requested: "bg-yellow-100 text-yellow-900",
  processed: "bg-green-100 text-green-900",
};

export const StatusBadge = ({ value }: { value?: string | null }) => {
  if (!value) return <Badge variant="outline">—</Badge>;
  const cls = colors[value] ?? "bg-secondary text-secondary-foreground";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{value.replace(/_/g, " ")}</span>;
};
