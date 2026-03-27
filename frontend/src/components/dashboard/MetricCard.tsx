interface MetricCardProps {
  label: string;
  value: string | number;
  delta: string;
  deltaType: "up" | "warn" | "neutral";
}

const deltaColors = {
  up: "text-green-700 dark:text-green-400",
  warn: "text-amber-700 dark:text-amber-400",
  neutral: "text-neutral-400",
};

export default function MetricCard({
  label,
  value,
  delta,
  deltaType,
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3.5 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div
        className={`text-[20px] font-medium ${
          deltaType === "warn"
            ? "text-amber-700 dark:text-amber-400"
            : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{label}</div>
      <div className={`mt-1.5 text-[11px] ${deltaColors[deltaType]}`}>{delta}</div>
    </div>
  );
}
