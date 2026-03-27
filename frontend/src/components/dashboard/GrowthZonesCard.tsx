import Link from "next/link";

export interface GrowthZone {
  topic_id?: number;
  name: string;
  mastery: number;
  complexity: number;
  status: "warn" | "mid" | "ok";
}

const cfg = {
  warn: {
    label: "Нужно внимание",
    bar: "#E24B4A",
    badge:
      "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  mid: {
    label: "В процессе",
    bar: "#EF9F27",
    badge:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  ok: {
    label: "Хорошо",
    bar: "#639922",
    badge:
      "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
};

interface GrowthZonesCardProps {
  zones: GrowthZone[];
  firstStudyHref?: string | null;
}

export default function GrowthZonesCard({
  zones,
  firstStudyHref,
}: GrowthZonesCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-0.5 text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
        Зоны роста
      </p>
      <p className="mb-4 text-[11px] text-neutral-400">
        Темы с наибольшим отставанием
      </p>

      <div className="flex flex-1 flex-col gap-2">
        {zones.length === 0 ? (
          <p className="text-[12px] text-neutral-500">
            Пока нет данных по темам — начните с колод ниже.
          </p>
        ) : (
          zones.map((zone) => (
            <div
              key={zone.topic_id ?? zone.name}
              className="flex items-center gap-3 rounded-lg border border-neutral-100 p-2.5 dark:border-neutral-800"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-neutral-900 dark:text-neutral-100">
                  {zone.name}
                </p>
                <p className="mt-0.5 text-[10px] text-neutral-400">
                  Освоено {zone.mastery}% · сложность{" "}
                  {zone.complexity.toFixed(2)}
                </p>
                <div className="mt-1.5 h-[3px] rounded-full bg-neutral-200 dark:bg-neutral-700">
                  <div
                    className="h-[3px] rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, zone.mastery))}%`,
                      background: cfg[zone.status].bar,
                    }}
                  />
                </div>
              </div>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${cfg[zone.status].badge}`}
              >
                {cfg[zone.status].label}
              </span>
            </div>
          ))
        )}
      </div>

      {firstStudyHref ? (
        <Link
          href={firstStudyHref}
          className="mt-4 w-full rounded-lg border border-neutral-200 py-2 text-center text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Ударить по пробелам →
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-4 w-full cursor-not-allowed rounded-lg border border-neutral-200 py-2 text-[12px] text-neutral-400 dark:border-neutral-700"
        >
          Ударить по пробелам →
        </button>
      )}
    </div>
  );
}
