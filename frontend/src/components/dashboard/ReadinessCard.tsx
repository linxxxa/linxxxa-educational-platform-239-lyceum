import { formatStudyTimeHours } from "@/lib/format-study-time";
import { knowledgeLevelLabel } from "@/lib/knowledge-level";

interface ReadinessCardProps {
  ri: number;
  mastery: number;
  /** Эффективность: (ΣQ)/(N·5)·100 по всем ответам. */
  efficiency: number;
  /** Дробные часы обучения (из API). */
  hours: number;
}

/** Длина дуги для r=28 в viewBox 72×72 */
const RING_CIRCUMFERENCE = 2 * Math.PI * 28;

export default function ReadinessCard({
  ri,
  mastery,
  efficiency,
  hours,
}: ReadinessCardProps) {
  const riClamped = Math.max(0, Math.min(100, ri));
  const offset = RING_CIRCUMFERENCE * (1 - riClamped / 100);
  const statusText = knowledgeLevelLabel(riClamped);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-4 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
        Твой уровень знаний
      </p>

      <div className="mb-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-40 w-40 shrink-0 lg:h-[200px] lg:w-[200px]">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 72 72"
            className="block"
            preserveAspectRatio="xMidYMid meet"
          >
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
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
            <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-400 sm:text-[10px]">
              Текущий балл
            </span>
            <span className="text-[16px] font-medium leading-none text-neutral-900 sm:text-[18px] dark:text-neutral-100 lg:text-[20px]">
              {Math.round(riClamped)}
            </span>
            <span className="mt-0.5 text-[8px] text-neutral-400 sm:text-[9px]">
              из 100
            </span>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
          <p className="text-center text-[13px] font-medium leading-snug text-neutral-800 sm:text-left dark:text-neutral-200">
            {statusText}
          </p>
          {[
            {
              label: "Освоено",
              value: `${mastery}%`,
              pct: Math.min(100, Math.max(0, mastery)),
            },
            {
              label: "Эффективность",
              value: `${Math.round(efficiency)}%`,
              pct: Math.min(100, Math.max(0, efficiency)),
            },
            {
              label: "Время занятий",
              value: formatStudyTimeHours(hours),
              pct: Math.min(100, Math.max(0, hours * 3)),
            },
          ].map(({ label, value, pct }) => (
            <div key={label} className="w-full">
              <div className="mb-1 flex justify-between gap-2">
                <span className="text-[11px] text-neutral-500">{label}</span>
                <span className="shrink-0 text-[11px] font-medium text-neutral-900 dark:text-neutral-100">
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
        <p className="text-[10px] leading-relaxed break-words text-neutral-400">
          Балл из 100 — среднее освоение колод: каждая карточка даёт долю темы, а
          последняя оценка Q (легко/средне/тяжело) определяет, насколько эта
          доля «закрыта». Дополнительно учитываются эффективность ответов и
          время практики.
        </p>
      </div>
    </div>
  );
}
