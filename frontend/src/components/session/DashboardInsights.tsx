"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { knowledgeLevelLabel } from "@/lib/knowledge-level";

interface WeakTopic {
  topic_unique_identifier: number;
  topic_display_name: string;
  entropy: number;
  avg_mastery: number;
  /** Освоение с учётом затухания (сервер), 0–100 */
  current_mastery?: number;
  /** H(T) для отображения */
  topic_complexity?: number;
}

interface InsightsPayload {
  readiness_index_ri: number;
  /** Нормализованный балл 0–100 (сырой индекс / 10), если задан отдельно от readiness_index_ri */
  readiness_index_view?: number;
  readiness_daily_delta: number;
  weak_topics: WeakTopic[];
}

/** Кольцо прогресса по шкале 0–100. */
function Ring({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const percent = clamped / 100;
  const dash = 282;
  const offset = dash * (1 - percent);
  const color = clamped < 40 ? "#A3A3A3" : clamped < 70 ? "#737373" : "#262626";

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0">
      <circle cx="64" cy="64" r="45" stroke="#E4E4E7" strokeWidth="8" fill="none" />
      <circle
        cx="64"
        cy="64"
        r="45"
        stroke={color}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
      />
    </svg>
  );
}

export default function DashboardInsights() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InsightsPayload>({
    readiness_index_ri: 0,
    readiness_daily_delta: 0,
    weak_topics: [],
  });

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/study/dashboard-insights", {
        headers: {
          Authorization: `Bearer ${t}`,
        },
      });
      if (res.ok) {
        const json = (await res.json()) as InsightsPayload;
        setData(json);
      }
      setLoading(false);
    };
    void load();
  }, []);

  const displayRi = useMemo(() => {
    const view =
      data.readiness_index_view ??
      Math.max(0, Math.min(100, Math.round(data.readiness_index_ri / 10)));
    return Math.round(view);
  }, [data.readiness_index_ri, data.readiness_index_view]);

  const ringValue = useMemo(() => {
    const raw =
      data.readiness_index_view ??
      Math.max(0, Math.min(100, data.readiness_index_ri / 10));
    return raw;
  }, [data.readiness_index_ri, data.readiness_index_view]);

  const levelStatus = useMemo(
    () => knowledgeLevelLabel(displayRi),
    [displayRi]
  );

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#27272A] dark:bg-[#18181B]" />
        <div className="h-48 animate-pulse rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#27272A] dark:bg-[#18181B]" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-8 dark:border-[#27272A] dark:bg-[#18181B]">
        <h2 className="font-[var(--font-geist-sans)] text-xl font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
          Твой уровень знаний
        </h2>
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="flex shrink-0 flex-col items-center sm:items-start">
            <div className="relative h-[128px] w-[128px]">
              <Ring value={ringValue} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1">
                <span className="text-center text-[9px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  Текущий балл
                </span>
                <span className="text-center font-[var(--font-geist-mono)] text-2xl font-medium tabular-nums leading-tight text-neutral-900 dark:text-neutral-100">
                  {displayRi}
                  <span className="text-lg font-normal text-neutral-500 dark:text-neutral-400">
                    {" "}
                    из 100
                  </span>
                </span>
              </div>
            </div>
            <p className="mt-3 max-w-[260px] text-center text-sm font-medium leading-snug text-neutral-800 dark:text-neutral-200 sm:text-left">
              {levelStatus}
            </p>
            <p className="mt-2 max-w-[260px] text-center text-xs leading-snug text-neutral-400 dark:text-neutral-500 sm:text-left">
              Балл из 100 учитывает освоение тем, стабильность ответов и время практики.
            </p>
          </div>
          <div className="min-w-0 flex-1 pt-0 sm:pt-1">
            <div className="text-sm text-neutral-500">Изменение за сегодня</div>
            <div className="mt-1 font-[var(--font-geist-mono)] text-sm tabular-nums text-neutral-700 dark:text-neutral-300">
              {data.readiness_daily_delta >= 0 ? "+" : ""}
              {data.readiness_daily_delta.toFixed(1)} за сегодня
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-8 dark:border-[#27272A] dark:bg-[#18181B]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-[var(--font-geist-sans)] text-xl font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
            Зоны роста
          </h2>
          <span className="text-xs text-neutral-500">Твои пробелы</span>
        </div>
        {data.weak_topics.length === 0 ? (
          <p className="px-2 py-4 text-sm leading-relaxed text-neutral-500">
            Все темы в порядке! Отдохни или повтори избранное.
          </p>
        ) : (
        <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A]">
          {data.weak_topics.slice(0, 4).map((topic) => {
            const masteryPct = Math.min(
              100,
              Math.max(
                0,
                topic.current_mastery ?? topic.avg_mastery
              )
            );
            const warnBand = masteryPct < 50;
            const barColor = warnBand ? "bg-red-600" : "bg-orange-500";
            const badge =
              warnBand ? (
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  Нужно внимание
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                  В процессе
                </span>
              );
            const hLabel =
              topic.topic_complexity != null &&
              Number.isFinite(topic.topic_complexity)
                ? topic.topic_complexity.toFixed(2)
                : topic.entropy.toFixed(2);
            return (
              <Link
                key={topic.topic_unique_identifier}
                href={`/study/${topic.topic_unique_identifier}`}
                className="block px-2 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {topic.topic_display_name}
                      </span>
                      {badge}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div
                        className={`h-full rounded-full transition-[width] ${barColor}`}
                        style={{ width: `${masteryPct}%` }}
                      />
                    </div>
                    <div className="mt-1 font-[var(--font-geist-mono)] text-[11px] tabular-nums text-neutral-500">
                      Текущее освоение: {masteryPct.toFixed(0)}%
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-[#E4E4E7] bg-white px-2 py-1 font-[var(--font-geist-mono)] text-xs tabular-nums text-neutral-600 dark:border-[#27272A] dark:bg-[#09090B] dark:text-neutral-300">
                    H(T): {hLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        )}
        {data.weak_topics[0] && (
          <Link
            href={`/study/${data.weak_topics[0].topic_unique_identifier}`}
            className="mt-4 inline-flex rounded-md border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-[12px] font-medium text-indigo-900 hover:bg-indigo-100/90 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-900/50"
          >
            Ударить по пробелам
          </Link>
        )}
      </section>
    </div>
  );
}
