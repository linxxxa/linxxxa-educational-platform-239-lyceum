interface Props {
  done: number;
  total: number;
  energy: number;
  topic?: string | null;
  subject?: string | null;
}

export default function SessionProgress({
  done,
  total,
  energy,
  topic,
  subject,
}: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const topicLabel = [subject, topic]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="w-full shrink-0">
      <div className="h-[3px] bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-[3px] bg-[#2F3437] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-3 px-4 py-2">
        <span className="min-w-0 flex-1 break-words text-[12px] text-neutral-500">
          {done} из {total}
          {topicLabel ? ` · ${topicLabel}` : ""}
        </span>
        <span className="shrink-0 text-[12px] text-neutral-500">
          E = {Math.round(energy)}
        </span>
      </div>
    </div>
  );
}
