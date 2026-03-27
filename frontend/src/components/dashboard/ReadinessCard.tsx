interface ReadinessCardProps {
  ri: number;
  mastery: number;
  sigma: number;
  hours: number;
}

export default function ReadinessCard({
  ri,
  mastery,
  sigma,
  hours,
}: ReadinessCardProps) {
  const circumference = 175.9;
  const riClamped = Math.max(0, Math.min(100, ri));
  const offset = circumference * (1 - riClamped / 100);

  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-0.5 text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
        Уровень готовности
      </p>
      <p className="mb-4 text-[11px] text-neutral-400">
        Балл = 70% знания + 20% стабильность + 10% время
      </p>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative h-[72px] w-[72px] shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72" className="block">
            <circle
              cx="36"
              cy="36"
              r="28"
              fill="none"
              strokeWidth="6"
              stroke="currentColor"
              className="text-neutral-200 dark:text-neutral-700"
            />
            <circle
              cx="36"
              cy="36"
              r="28"
              fill="none"
              strokeWidth="6"
              stroke="#2F3437"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[18px] font-medium leading-none text-neutral-900 dark:text-neutral-100">
              {Math.round(riClamped)}
            </span>
            <span className="mt-0.5 text-[9px] text-neutral-400">из 100</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          {[
            {
              label: "Знания (×700)",
              value: `${mastery}%`,
              pct: Math.min(100, Math.max(0, mastery)),
            },
            {
              label: "Стабильность (×200)",
              value: `${sigma}%`,
              pct: Math.min(100, Math.max(0, sigma)),
            },
            {
              label: "Время (×100)",
              value: `${hours}ч`,
              pct: Math.min(100, Math.max(0, hours * 3)),
            },
          ].map(({ label, value, pct }) => (
            <div key={label}>
              <div className="mb-1 flex justify-between">
                <span className="text-[11px] text-neutral-500">{label}</span>
                <span className="text-[11px] font-medium text-neutral-900 dark:text-neutral-100">
                  {value}
                </span>
              </div>
              <div className="h-[3px] rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className="h-[3px] rounded-full bg-[#2F3437] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <p className="text-[10px] leading-relaxed text-neutral-400">
          Твой прогноз · продолжай в том же темпе, чтобы достичь 60 к концу недели
        </p>
      </div>
    </div>
  );
}
