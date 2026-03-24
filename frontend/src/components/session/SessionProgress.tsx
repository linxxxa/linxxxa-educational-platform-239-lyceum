interface Props {
  done: number;
  total: number;
  energy: number;
  topic: string;
  subject: string;
}

export default function SessionProgress({
  done,
  total,
  energy,
  topic,
  subject,
}: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="h-[3px] bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-[3px] bg-[#2F3437] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-[520px] items-center justify-between px-4 py-2">
        <span className="text-[12px] text-neutral-500">
          {done} из {total} · {subject} · {topic}
        </span>
        <span className="text-[12px] text-neutral-500">E = {Math.round(energy)}</span>
      </div>
    </div>
  );
}
