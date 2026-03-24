const DIFFICULTY_LABELS = [
  "",
  "Очень легко",
  "Легко",
  "Средне",
  "Сложно",
  "Очень сложно",
];

export default function DifficultyDots({ level }: { level: number }) {
  const safe = Math.min(5, Math.max(0, level));
  return (
    <div
      className="flex items-center gap-1"
      title={DIFFICULTY_LABELS[safe] ?? ""}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < safe
              ? "bg-[#2F3437] dark:bg-neutral-300"
              : "bg-neutral-200 dark:bg-neutral-700"
          }`}
        />
      ))}
    </div>
  );
}
