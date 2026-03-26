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
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">
          Колоды
        </h3>
        <Link
          href="/dashboard/topics"
          className="text-[12px] text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Управлять →
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
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <div
              key={t.topic_unique_identifier}
              className={`rounded-full border px-3 py-1 text-[12px] ${
                t.is_public_visibility
                  ? "border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                  : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              }`}
              title={
                t.is_public_visibility ? "Публичная" : "Приватная"
              }
            >
              <span className="font-medium">{t.topic_display_name}</span>
              <span className="ml-2 text-neutral-500 dark:text-neutral-400">
                ({t.related_topics_count})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

