"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchSubjects, fetchTopics } from "@/lib/api/content";
import { getToken } from "@/lib/auth";
import type { LearningSubjectRecord, TopicListItem } from "@/types/learning";

function TopicsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg border border-neutral-100 bg-neutral-200/80 dark:border-neutral-800 dark:bg-neutral-800/80"
        />
      ))}
    </div>
  );
}

export default function TopicsListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<LearningSubjectRecord[]>([]);
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<number | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [subList, topList] = await Promise.all([
        fetchSubjects(),
        fetchTopics(
          filterSubjectId === "all" ? undefined : filterSubjectId
        ),
      ]);
      setSubjects(subList);
      setTopics(topList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [router, filterSubjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-medium text-neutral-900 dark:text-neutral-100">
              Мои колоды
            </h1>
            <p className="text-[13px] text-neutral-500">
              Темы и привязка к предметам
            </p>
          </div>
          <Link
            href="/dashboard/topics/create"
            className="rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-[0.85]"
          >
            + Новая колода
          </Link>
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-[12px] text-neutral-500">
            Предмет
          </label>
          <select
            value={filterSubjectId === "all" ? "all" : String(filterSubjectId)}
            onChange={(e) =>
              setFilterSubjectId(
                e.target.value === "all" ? "all" : Number(e.target.value)
              )
            }
            className="h-9 w-full max-w-xs rounded-md border border-neutral-200 bg-white px-3 text-[13px] dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="all">Все предметы</option>
            {subjects.map((s) => (
              <option
                key={s.subject_unique_identifier}
                value={s.subject_unique_identifier}
              >
                {s.subject_display_name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="mb-4 text-[13px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <TopicsSkeleton />
        ) : topics.length === 0 ? (
          <p className="text-[13px] text-neutral-500">
            Пока нет тем.{" "}
            <Link href="/dashboard/topics/create" className="underline">
              Создать колоду
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {topics.map((t) => (
              <li
                key={t.topic_unique_identifier}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="font-medium text-neutral-900 dark:text-neutral-100">
                  {t.topic_display_name}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-neutral-500">
                  <span>ID темы: {t.topic_unique_identifier}</span>
                  <span>
                    {t.is_public_visibility ? "Публичная" : "Приватная"}
                  </span>
                  <span>K связей: {t.related_topics_count}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8">
          <Link
            href="/dashboard"
            className="text-[13px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ← К учёбе
          </Link>
        </p>
      </div>
    </main>
  );
}
