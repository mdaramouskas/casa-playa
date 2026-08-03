const LABELS: Record<string, { text: string; className: string }> = {
  PAID: { text: "Πληρωμένη", className: "bg-emerald-100 text-emerald-900" },
  PENDING: { text: "Εκκρεμεί", className: "bg-amber-100 text-amber-900" },
  FAILED: { text: "Απέτυχε", className: "bg-red-100 text-red-900" },
  CANCELLED: { text: "Ακυρωμένη", className: "bg-neutral-200 text-neutral-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const badge = LABELS[status] ?? {
    text: status,
    className: "bg-neutral-100 text-neutral-700",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}
    >
      {badge.text}
    </span>
  );
}
