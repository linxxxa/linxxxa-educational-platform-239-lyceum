"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTopic, fetchSubjects, fetchTopics, updateTopic } from "@/lib/api/content";
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
  const [editing, setEditing] = useState<TopicListItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState<string>("");
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    const url = new URL(window.location.href);
    const focus = url.searchParams.get("focus");
    if (!focus) return;
    const el = document.getElementById(`topic-${focus}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-neutral-300");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-neutral-300"), 1200);
    }
  }, [topics.length]);

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
                id={`topic-${t.topic_unique_identifier}`}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                      {t.topic_display_name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-neutral-500">
                      <span>ID темы: {t.topic_unique_identifier}</span>
                      <span>K связей: {t.related_topics_count}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/study/${t.topic_unique_identifier}`}
                      className="rounded-md bg-[#2F3437] px-3 py-1.5 text-[12px] font-medium text-white"
                    >
                      Повторить →
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(t);
                        setEditName(t.topic_display_name);
                        setEditDesc(t.topic_description_text ?? "");
                      }}
                      className="rounded-md border border-neutral-200 px-3 py-1.5 text-[12px] text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                      Редактировать
                    </button>
                    <Link
                      href={`/dashboard/topics/${t.topic_unique_identifier}/cards/add`}
                      className="rounded-md border border-neutral-200 px-3 py-1.5 text-[12px] text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                      + Карточки
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = window.confirm("Удалить колоду и её карточки?");
                        if (!ok) return;
                        try {
                          await deleteTopic(t.topic_unique_identifier);
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Ошибка удаления");
                        }
                      }}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-[12px] text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      Удалить
                    </button>
                  </div>
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-4">
              <h2 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
                Редактировать колоду
              </h2>
              <p className="text-[12px] text-neutral-500">
                Изменение названия и описания.
              </p>
            </div>

            <label className="mb-1 block text-[12px] text-neutral-500">
              Название
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] dark:border-neutral-800 dark:bg-neutral-900"
            />

            <label className="mt-4 mb-1 block text-[12px] text-neutral-500">
              Описание
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="min-h-[90px] w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] dark:border-neutral-800 dark:bg-neutral-900"
            />

            <p className="mt-4">
              <Link
                href={`/dashboard/topics/${editing.topic_unique_identifier}/cards/add`}
                onClick={() => setEditing(null)}
                className="text-[13px] font-medium text-[#2F3437] underline-offset-2 hover:underline dark:text-neutral-200"
              >
                Карточки колоды: список, правка и удаление
              </Link>
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-neutral-200 px-4 py-2 text-[13px] text-neutral-700 dark:border-neutral-800 dark:text-neutral-200"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  if (!editing) return;
                  setSaving(true);
                  setError(null);
                  try {
                    await updateTopic(editing.topic_unique_identifier, {
                      topic_display_name: editName,
                      topic_description_text: editDesc,
                    });
                    setEditing(null);
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Ошибка сохранения");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
