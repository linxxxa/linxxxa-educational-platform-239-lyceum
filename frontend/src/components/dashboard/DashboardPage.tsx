"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  accuracy_week_pct: number;
  total_cards_studied: number;
  mastery_avg_pct: number;
  learning_efficiency_pct: number;
  hours_learning: number;
  weak_topic_name: string;
  weak_topic_mastery_pct: number;
  zones: (GrowthZone & { topic_id?: number })[];
  decks: Deck[];
}

function num(x: unknown, fallback = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDeck(d: unknown): Deck {
  const o = d && typeof d === "object" ? (d as Record<string, unknown>) : {};
  const mastery = Math.max(0, Math.min(100, Math.round(num(o.mastery, 0))));
  const ml =
    typeof o.mastery_label === "string" ? o.mastery_label.trim() : undefined;
  return {
    id: Math.floor(num(o.id, 0)),
    name: typeof o.name === "string" ? o.name : "Без названия",
    connections: Math.max(0, Math.floor(num(o.connections, 0))),
    cards_count: Math.max(0, Math.floor(num(o.cards_count, 0))),
    mastery,
    mastery_label: ml !== undefined && ml !== "" ? ml : undefined,
    show_mastery_zero: o.show_mastery_zero !== false,
  };
}

function normalizeZone(z: unknown): GrowthZone & { topic_id?: number } {
  const o = z && typeof z === "object" ? (z as Record<string, unknown>) : {};
  const mastery = Math.max(0, Math.min(100, Math.round(num(o.mastery, 0))));
  const complexity = num(o.complexity, 1.2);
  const status =
    o.status === "warn" || o.status === "mid" || o.status === "ok"
      ? o.status
      : mastery < 30
        ? "warn"
        : mastery < 60
          ? "mid"
          : "ok";
  const out: GrowthZone & { topic_id?: number } = {
    name: typeof o.name === "string" ? o.name : "Без названия",
    mastery,
    complexity: Number.isFinite(complexity) ? complexity : 1.2,
    status,
  };
  if (typeof o.topic_id === "number" && Number.isFinite(o.topic_id)) {
    out.topic_id = o.topic_id;
  }
  return out;
}

function normalizeDashboardPayload(raw: unknown): DashboardHomePayload {
  const j =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const decksRaw = Array.isArray(j.decks) ? j.decks : [];
  const zonesRaw = Array.isArray(j.zones) ? j.zones : [];
  return {
    user_name:
      typeof j.user_name === "string" && j.user_name.trim()
        ? j.user_name
        : "Студент",
    readiness_index_view: Math.max(
      0,
      Math.min(100, num(j.readiness_index_view, 0))
    ),
    readiness_index_ri: num(j.readiness_index_ri, 0),
    readiness_daily_delta: num(j.readiness_daily_delta, 0),
    accuracy_week_pct: Math.max(
      0,
      Math.min(100, Math.round(num(j.accuracy_week_pct, 0)))
    ),
    total_cards_studied: Math.max(
      0,
      Math.floor(num(j.total_cards_studied, 0))
    ),
    mastery_avg_pct: Math.max(
      0,
      Math.min(100, Math.round(num(j.mastery_avg_pct, 0)))
    ),
    learning_efficiency_pct: Math.max(
      0,
      Math.min(
        100,
        j.learning_efficiency_pct != null && j.learning_efficiency_pct !== ""
          ? num(j.learning_efficiency_pct, 0)
          : num(j.sigma_norm_pct, 0)
      )
    ),
    hours_learning: Math.max(0, num(j.hours_learning, 0)),
    weak_topic_name:
      typeof j.weak_topic_name === "string" ? j.weak_topic_name : "—",
    weak_topic_mastery_pct: Math.max(
      0,
      Math.min(100, Math.round(num(j.weak_topic_mastery_pct, 0)))
    ),
    zones: zonesRaw.map(normalizeZone),
    decks: decksRaw.map(normalizeDeck),
  };
}

function truncateLabel(s: string, max = 18): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function PageContent({ children }: { children: React.ReactNode }) {
  return <div className="w-full min-w-0">{children}</div>;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /** Примитивы из query — сам объект searchParams часто меняет ссылку и зацикливает эффекты. */
  const shareTokenQuery = searchParams.get("shareToken")?.trim() ?? "";
  const refreshQuery = searchParams.get("refresh");
  const deckIdQuery = searchParams.get("deckId")?.trim() ?? "";
  const [data, setData] = useState<DashboardHomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didLoadRef = useRef(false);
  const mountedRef = useRef(false);
  const activeRequestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!shareTokenQuery) return;
    router.replace(`/decks/share/${encodeURIComponent(shareTokenQuery)}`);
  }, [router, shareTokenQuery]);

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    if (mountedRef.current) setError(null);

    activeRequestAbortRef.current?.abort();
    const controller = new AbortController();
    activeRequestAbortRef.current = controller;

    let res: Response;
    try {
      res = await fetch("/api/study/dashboard-home", {
        headers: { Authorization: `Bearer ${t}` },
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      // Abort on route change/unmount should be silent.
      if (controller.signal.aborted) return;
      if (mountedRef.current) {
        setError("Не удалось загрузить дашборд");
      }
      return;
    }
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      if (mountedRef.current) setError("Не удалось загрузить дашборд");
      return;
    }
    const json: unknown = await res.json();
    if (mountedRef.current) setData(normalizeDashboardPayload(json));
  }, [router]);

  useEffect(() => {
    if (refreshQuery !== "1" && refreshQuery !== "progress") return;
    queueMicrotask(() => {
      void load();
      window.dispatchEvent(new CustomEvent("edulab-dashboard-refresh"));
      router.replace("/dashboard", { scroll: false });
    });
  }, [router, refreshQuery, load]);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("edulab-dashboard-refresh", onRefresh);
    return () => window.removeEventListener("edulab-dashboard-refresh", onRefresh);
  }, [load]);

  useEffect(() => {
    if (!data?.decks?.length) return;
    if (!deckIdQuery) return;
    const id = Number(deckIdQuery);
    if (!Number.isFinite(id)) return;
    const hasDeck = data.decks.some((d) => d.id === id);
    if (!hasDeck) return;
    const el = document.getElementById(`deck-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data, deckIdQuery]);

  if (!data && !error) {
    return (
      <PageContent>
        <div className="h-40 animate-pulse rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80" />
      </PageContent>
    );
  }

  if (error || !data) {
    return (
      <PageContent>
        <p className="text-sm text-red-600">{error ?? "Неизвестная ошибка"}</p>
      </PageContent>
    );
  }

  const riView = Math.max(
    0,
    Math.min(100, Math.round(data.readiness_index_ri / 10))
  );
  const deltaRi = Number.isFinite(data.readiness_daily_delta)
    ? data.readiness_daily_delta
    : 0;
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
    <PageContent>
      <div className="mb-5">
        <h1 className="text-[20px] font-medium text-neutral-900 dark:text-neutral-100">
          Добрый день, {data.user_name}
        </h1>
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          label="Уровень знаний"
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
          delta={
            data.weak_topic_mastery_pct >= 100
              ? "все колоды в норме"
              : "нужно внимание"
          }
          deltaType={
            data.weak_topic_mastery_pct >= 100 ? "neutral" : "warn"
          }
        />
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2">
        <ReadinessCard
          ri={riView}
          mastery={data.mastery_avg_pct}
          efficiency={data.learning_efficiency_pct}
          hours={data.hours_learning}
        />
        <GrowthZonesCard
          zones={data.zones.slice(0, 4)}
          firstStudyHref={firstStudyHref}
          showAllClearMessage={data.decks.length > 0}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
            Колоды
          </span>
          <Link
            href="/dashboard/decks"
            className="text-[11px] text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Все колоды →
          </Link>
        </div>
        {data.decks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
            <p className="mb-3 text-[14px] text-neutral-500">
              Колод пока нет
            </p>
            <Link
              href="/dashboard/topics/create"
              className="inline-block rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-[0.85]"
            >
              Создать первую колоду →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.decks.map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        )}
      </div>
    </PageContent>
  );
}
