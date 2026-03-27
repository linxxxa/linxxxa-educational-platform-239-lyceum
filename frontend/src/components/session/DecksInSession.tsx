"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchTopics } from "@/lib/api/content";
import { getToken } from "@/lib/auth";
import type { TopicListItem } from "@/types/learning";

function TopicsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-8 w-[140px] animate-pulse rounded-full border border-neutral-200 bg-neutral-100/60 dark:border-neutral-800 dark:bg-neutral-800/60"
        />
      ))}
    </div>
  );
}

export default function DecksInSession() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const t = await fetchTopics();
      setTopics(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки колод");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[720px] px-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-[var(--font-geist-sans)] text-base font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
          Колоды
        </h3>
        <Link
          href="/dashboard/topics"
          className="text-[12px] text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Все темы →
        </Link>
      </div>

      {error && (
        <p className="mb-2 text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <TopicsSkeleton />
      ) : topics.length === 0 ? (
        <p className="text-[12px] text-neutral-500">
          Колод пока нет. Создайте первую на странице тем.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {topics.map((t) => (
            <div
              key={t.topic_unique_identifier}
              className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 dark:border-[#27272A] dark:bg-[#18181B]"
            >
              <div className="min-w-0">
                <div className="truncate font-[var(--font-geist-sans)] text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t.topic_display_name}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-[#E4E4E7] bg-white px-2 py-0.5 font-[var(--font-geist-mono)] text-[10px] tabular-nums text-neutral-600 dark:border-[#27272A] dark:bg-[#09090B] dark:text-neutral-400">
                    Связей: {t.related_topics_count}
                  </span>
                  <span className="rounded-md border border-[#E4E4E7] bg-white px-2 py-0.5 text-[10px] text-neutral-500 dark:border-[#27272A] dark:bg-[#09090B]">
                    {t.is_public_visibility ? "Публичная" : "Приватная"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#E4E4E7] pt-3 dark:border-[#27272A]">
                <Link
                  href={`/study/${t.topic_unique_identifier}`}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-md bg-[#2F3437] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f2326]"
                  title="Начать повторение"
                >
                  Повторить
                </Link>
                <Link
                  href={`/dashboard/topics?focus=${t.topic_unique_identifier}`}
                  className="text-[12px] text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                  Управлять
                </Link>
                <Link
                  href={`/dashboard/topics/${t.topic_unique_identifier}/cards/add`}
                  className="text-[12px] text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                  + Карточки
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
