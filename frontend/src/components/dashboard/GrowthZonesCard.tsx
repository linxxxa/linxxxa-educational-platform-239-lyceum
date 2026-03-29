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
    bar: "#dc2626",
    badge: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  },
  mid: {
    label: "В процессе",
    bar: "#ea580c",
    badge: "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  },
  ok: {
    label: "В процессе",
    bar: "#ea580c",
    badge: "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  },
};

function zoneVisualStatus(zone: GrowthZone): "warn" | "mid" {
  if (zone.status === "warn" || zone.status === "mid") return zone.status;
  return zone.mastery < 50 ? "warn" : "mid";
}

interface GrowthZonesCardProps {
  zones: GrowthZone[];
  firstStudyHref?: string | null;
  /** Если true и список зон пуст — показываем «все темы в порядке». */
  showAllClearMessage?: boolean;
}

export default function GrowthZonesCard({
  zones,
  firstStudyHref,
  showAllClearMessage = false,
}: GrowthZonesCardProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
        Зоны роста
      </p>
      <p className="mb-4 text-[11px] text-neutral-400">
        Темы, где освоение ниже 80% (с учётом времени с последней сессии)
      </p>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {zones.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-neutral-500">
            {showAllClearMessage ? (
              <>
                Все темы в порядке! Отдохни или повтори избранное.
              </>
            ) : (
              <>Пока нет данных по темам — начните с колод ниже.</>
            )}
          </p>
        ) : (
          zones.map((zone) => {
            const visual = zoneVisualStatus(zone);
            return (
              <div
                key={zone.topic_id ?? zone.name}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-neutral-100 p-2.5 dark:border-neutral-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-neutral-900 dark:text-neutral-100">
                    {zone.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-neutral-400">
                    Освоено {zone.mastery}% · сложность H(T){" "}
                    {zone.complexity.toFixed(2)}
                  </p>
                  <div className="mt-1.5 h-[3px] rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <div
                      className="h-[3px] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, zone.mastery))}%`,
                        background: cfg[visual].bar,
                      }}
                    />
                  </div>
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-medium ${cfg[visual].badge}`}
                >
                  {cfg[visual].label}
                </span>
              </div>
            );
          })
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
