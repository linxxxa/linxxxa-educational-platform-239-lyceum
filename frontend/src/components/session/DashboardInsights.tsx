"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";

interface WeakTopic {
  topic_unique_identifier: number;
  topic_display_name: string;
  entropy: number;
  avg_mastery: number;
}

interface InsightsPayload {
  readiness_index_ri: number;
  readiness_daily_delta: number;
  weak_topics: WeakTopic[];
}

function Ring({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1000, value));
  const percent = clamped / 1000;
  const dash = 282;
  const offset = dash * (1 - percent);
  const color = clamped < 400 ? "#A3A3A3" : clamped < 700 ? "#737373" : "#262626";

  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
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

  const riRounded = useMemo(
    () => Math.max(0, Math.min(1000, Math.round(data.readiness_index_ri))),
    [data.readiness_index_ri]
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
        <h2 className="text-sm text-neutral-900 dark:text-neutral-100">
          Readiness Index
        </h2>
        <div
          className="mt-4 flex items-center gap-4"
          title="70% Точность + 20% Стабильность + 10% Время"
        >
          <div className="relative h-[128px] w-[128px]">
            <Ring value={riRounded} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-[var(--font-geist-mono)] text-3xl font-medium text-slate-900 dark:text-slate-100">
                {riRounded}
              </div>
              <div className="text-xs uppercase tracking-[0.08em] text-neutral-500">
                Estimated score
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-500">Readiness trend</div>
            <div className="text-sm text-neutral-500">
              {data.readiness_daily_delta >= 0 ? "+" : ""}
              {data.readiness_daily_delta.toFixed(1)} за сегодня
            </div>
            <div className="mt-2 text-xs text-neutral-500">70/20/10 formula</div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-8 dark:border-[#27272A] dark:bg-[#18181B]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm text-neutral-900 dark:text-neutral-100">
            Слабые темы
          </h2>
          <span className="text-xs text-neutral-500">Friction list</span>
        </div>
        <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A]">
          {data.weak_topics.slice(0, 4).map((topic) => (
            <Link
              key={topic.topic_unique_identifier}
              href={`/study/${topic.topic_unique_identifier}`}
              className="flex items-center justify-between px-2 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {topic.topic_display_name}
                </div>
                <div className="text-xs text-neutral-500">
                  Mastery: {topic.avg_mastery.toFixed(0)}%
                </div>
              </div>
              <span className="rounded-md border border-[#E4E4E7] bg-white px-2 py-1 text-xs text-neutral-600 dark:border-[#27272A] dark:bg-[#09090B] dark:text-neutral-300">
                H(T): {topic.entropy.toFixed(2)}
              </span>
            </Link>
          ))}
        </div>
        {data.weak_topics[0] && (
          <Link
            href={`/study/${data.weak_topics[0].topic_unique_identifier}`}
            className="mt-4 inline-flex rounded-md bg-[#2F3437] px-3 py-2 text-[12px] font-medium text-white"
          >
            Ударить по пробелам
          </Link>
        )}
      </section>
    </div>
  );
}

