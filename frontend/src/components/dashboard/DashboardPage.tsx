"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import DeckCard from "./DeckCard";
import type { Deck } from "./DeckCard";
import GrowthZonesCard from "./GrowthZonesCard";
import type { GrowthZone } from "./GrowthZonesCard";
import MetricCard from "./MetricCard";
import ReadinessCard from "./ReadinessCard";

interface DashboardHomePayload {
  user_name: string;
  readiness_index_view: number;
  readiness_index_ri: number;
  readiness_daily_delta: number;
  due_today_count: number;
  streak_days: number;
  accuracy_week_pct: number;
  total_cards_studied: number;
  mastery_avg_pct: number;
  sigma_norm_pct: number;
  hours_learning: number;
  weak_topic_name: string;
  weak_topic_mastery_pct: number;
  zones: (GrowthZone & { topic_id?: number })[];
  decks: Deck[];
}

function truncateLabel(s: string, max = 18): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardHomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    setError(null);
    const res = await fetch("/api/study/dashboard-home", {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setError("Не удалось загрузить дашборд");
      return;
    }
    const json = (await res.json()) as DashboardHomePayload;
    setData(json);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data && !error) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <div className="h-40 animate-pulse rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-100 px-5 py-6 dark:bg-neutral-950">
        <div className="mx-auto max-w-5xl text-sm text-red-600">
          {error ?? "Неизвестная ошибка"}
        </div>
      </div>
    );
  }

  const riView = Math.round(
    Math.max(0, Math.min(100, data.readiness_index_view))
  );
  const deltaRi = data.readiness_daily_delta;
  const deltaLabel = `${deltaRi >= 0 ? "+" : ""}${deltaRi.toFixed(1)} сегодня`;
  const weakTopicShort = truncateLabel(data.weak_topic_name);

  const firstZone = data.zones[0];
  const firstStudyHref =
    firstZone != null && firstZone.topic_id != null
      ? `/study/${firstZone.topic_id}`
      : data.decks[0] != null
        ? `/study/${data.decks[0].id}`
        : null;

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="mb-4">
          <h1 className="text-[20px] font-medium text-neutral-900 dark:text-neutral-100">
            Добрый день, {data.user_name}
          </h1>
          <p className="mt-1 text-[12px] text-neutral-500">
            {data.due_today_count} карточек на сегодня · стрик{" "}
            {data.streak_days} дней
          </p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricCard
            label="Индекс готовности"
            value={riView}
            delta={deltaLabel}
            deltaType={deltaRi >= 0 ? "up" : "neutral"}
          />
          <MetricCard
            label="Точность ответов"
            value={`${data.accuracy_week_pct}%`}
            delta="за последние 7 дней"
            deltaType="neutral"
          />
          <MetricCard
            label="Карточек изучено"
            value={data.total_cards_studied}
            delta="всего"
            deltaType="neutral"
          />
          <MetricCard
            label={`Освоение ${weakTopicShort}`}
            value={`${data.weak_topic_mastery_pct}%`}
            delta="нужно внимание"
            deltaType="warn"
          />
        </div>

        <div className="mb-3 grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
          <ReadinessCard
            ri={riView}
            mastery={data.mastery_avg_pct}
            sigma={data.sigma_norm_pct}
            hours={data.hours_learning}
          />
          <GrowthZonesCard
            zones={data.zones.slice(0, 4)}
            firstStudyHref={firstStudyHref}
          />
        </div>

        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
              Колоды
            </span>
            <a
              href="/dashboard/decks"
              className="text-[11px] text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Все темы →
            </a>
          </div>
          {data.decks.length === 0 ? (
            <p className="text-[12px] text-neutral-500">
              Колод пока нет. Создайте тему в разделе «Все темы».
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.decks.map((deck) => (
                <DeckCard key={deck.id} deck={deck} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
