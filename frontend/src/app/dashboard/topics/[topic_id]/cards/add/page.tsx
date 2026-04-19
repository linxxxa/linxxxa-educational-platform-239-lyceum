"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CardPayloadItem, CardTypeCategoryProtocol } from "@/types/learning";
import {
  addCardsToTopic,
  deleteTopicCard,
  fetchCardsInTopic,
  type TopicCardListItem,
  updateTopicCard,
} from "@/lib/api/content";
import { getToken } from "@/lib/auth";
import { validateLatexDelimiters } from "@/lib/latex-validation";
import { CardSlotEditor } from "@/components/content/CardSlotEditor";

function emptyCard(): CardPayloadItem {
  return {
    card_content_question_latex: "",
    card_content_answer_latex: "",
    card_type_category: "CONCEPT",
  };
}

function topicCardToPayload(c: TopicCardListItem): CardPayloadItem {
  const cat: CardTypeCategoryProtocol =
    c.card_type_category === "FORMULA" || c.card_type_category === "TASK"
      ? c.card_type_category
      : "CONCEPT";
  return {
    card_content_question_latex: c.question_text,
    card_content_answer_latex: c.answer_text,
    card_type_category: cat,
  };
}

function previewText(s: string, max = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t || "—";
  return `${t.slice(0, max)}…`;
}

const TYPE_LABEL: Record<CardTypeCategoryProtocol, string> = {
  CONCEPT: "Понятие",
  FORMULA: "Формула",
  TASK: "Задача",
};

export default function AddCardsToTopicPage({
  params,
}: {
  params: Promise<{ topic_id: string }>;
}) {
  const router = useRouter();
  const [topicIdRaw, setTopicIdRaw] = useState<string>("");

  useEffect(() => {
    params.then((p) => setTopicIdRaw(p.topic_id));
  }, [params]);

  const topicId = useMemo(() => Number(topicIdRaw), [topicIdRaw]);

  const [existingCards, setExistingCards] = useState<TopicCardListItem[]>([]);
  const [existingLoading, setExistingLoading] = useState(true);
  const [existingError, setExistingError] = useState<string | null>(null);

  const reloadExisting = useCallback(async () => {
    if (!Number.isFinite(topicId) || topicId <= 0) return;
    setExistingLoading(true);
    setExistingError(null);
    try {
      const list = await fetchCardsInTopic(topicId, 500);
      setExistingCards(list);
    } catch (e) {
      setExistingError(e instanceof Error ? e.message : "Ошибка загрузки");
      setExistingCards([]);
    } finally {
      setExistingLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void reloadExisting();
  }, [reloadExisting, router]);

  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<CardPayloadItem>(() => emptyCard());
  const [editErrors, setEditErrors] = useState<{
    question?: string;
    answer?: string;
  }>({});
  const [editSaving, setEditSaving] = useState(false);

  const startEdit = useCallback((c: TopicCardListItem) => {
    setEditingCardId(c.card_id);
    setEditDraft(topicCardToPayload(c));
    setEditErrors({});
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCardId(null);
    setEditDraft(emptyCard());
    setEditErrors({});
  }, []);

  const patchEditDraft = useCallback((patch: Partial<CardPayloadItem>) => {
    setEditDraft((prev) => ({ ...prev, ...patch }));
    setEditErrors({});
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingCardId == null) return;
    const qe = validateLatexDelimiters(editDraft.card_content_question_latex);
    const ae = validateLatexDelimiters(editDraft.card_content_answer_latex);
    if (qe || ae) {
      setEditErrors({ question: qe ?? undefined, answer: ae ?? undefined });
      return;
    }
    if (
      !editDraft.card_content_question_latex.trim() ||
      !editDraft.card_content_answer_latex.trim()
    ) {
      setEditErrors({ question: "Заполните вопрос и ответ" });
      return;
    }
    setEditSaving(true);
    setExistingError(null);
    try {
      await updateTopicCard(topicId, editingCardId, editDraft);
      await reloadExisting();
      cancelEdit();
    } catch (e) {
      setExistingError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setEditSaving(false);
    }
  }, [cancelEdit, editDraft, editingCardId, reloadExisting, topicId]);

  const handleDeleteExisting = useCallback(
    async (cardId: number) => {
      const ok = window.confirm("Удалить эту карточку из колоды?");
      if (!ok) return;
      setExistingError(null);
      try {
        await deleteTopicCard(topicId, cardId);
        if (editingCardId === cardId) cancelEdit();
        await reloadExisting();
      } catch (e) {
        setExistingError(e instanceof Error ? e.message : "Ошибка удаления");
      }
    },
    [cancelEdit, editingCardId, reloadExisting, topicId]
  );

  const [cards, setCards] = useState<CardPayloadItem[]>([]);
  const [cardErrors, setCardErrors] = useState<
    Record<number, { question?: string; answer?: string }>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCardPatch = useCallback(
    (index: number, patch: Partial<CardPayloadItem>) => {
      setCards((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
      setCardErrors((prev) => {
        const ce = { ...prev[index] };
        delete ce.question;
        delete ce.answer;
        return { ...prev, [index]: ce };
      });
    },
    []
  );

  const addSlot = () => setCards((prev) => [...prev, emptyCard()]);
  const removeSlot = (i: number) =>
    setCards((prev) => prev.filter((_, j) => j !== i));

  const validateAll = (): boolean => {
    const err: Record<number, { question?: string; answer?: string }> = {};
    let ok = true;
    cards.forEach((c, i) => {
      const qe = validateLatexDelimiters(c.card_content_question_latex);
      const ae = validateLatexDelimiters(c.card_content_answer_latex);
      if (qe || ae) {
        err[i] = { question: qe ?? undefined, answer: ae ?? undefined };
        ok = false;
      }
    });
    setCardErrors(err);
    if (cards.length === 0) {
      setGeneralError(null);
    } else {
      setGeneralError(null);
    }
    return ok;
  };

  const handleSubmit = useCallback(async () => {
    setGeneralError(null);
    if (!validateAll()) return;
    const filled = cards.filter(
      (c) =>
        c.card_content_question_latex.trim() && c.card_content_answer_latex.trim()
    );
    if (filled.length === 0) {
      setGeneralError("Заполните хотя бы одну новую карточку или отредактируйте существующие выше");
      return;
    }
    setSaving(true);
    try {
      await addCardsToTopic(topicId, { new_card_payload_collection: filled });
      setCards([]);
      await reloadExisting();
      router.push(`/dashboard/topics?focus=${topicId}`);
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [cards, router, topicId, reloadExisting]);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-[880px] space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/topics"
            className="text-[13px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ← К колодам
          </Link>
          <button
            type="button"
            onClick={addSlot}
            className="rounded-md border border-dashed border-neutral-300 px-4 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            + Новая карточка
          </button>
        </div>

        <div>
          <h1 className="text-[22px] font-medium text-neutral-900 dark:text-neutral-100">
            Карточки колоды
          </h1>
          <p className="text-[13px] text-neutral-500">
            Колода ID: {topicId}. Просмотр, правка и удаление существующих; ниже —
            только добавление новых.
          </p>
        </div>

        {(generalError || existingError) && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {generalError ?? existingError}
          </div>
        )}

        <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
            Уже в колоде ({existingLoading ? "…" : existingCards.length})
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Можно изменить текст, тип или удалить карточку.
          </p>

          {existingLoading ? (
            <div className="mt-4 h-24 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
          ) : existingCards.length === 0 ? (
            <p className="mt-4 text-[13px] text-neutral-500">
              В этой колоде пока нет карточек. Добавьте новые блоком ниже.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {existingCards.map((c) => (
                <li
                  key={c.card_id}
                  className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-neutral-400">
                        #{c.card_id} ·{" "}
                        {TYPE_LABEL[
                          c.card_type_category === "FORMULA" ||
                          c.card_type_category === "TASK"
                            ? c.card_type_category
                            : "CONCEPT"
                        ]}{" "}
                        · освоение{" "}
                        {typeof c.mastery_level === "number"
                          ? `${Math.round(c.mastery_level)}%`
                          : "—"}
                      </p>
                      <p className="mt-1 text-[12px] text-neutral-700 dark:text-neutral-300">
                        <span className="font-medium text-neutral-500">В:</span>{" "}
                        {previewText(c.question_text)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-neutral-700 dark:text-neutral-300">
                        <span className="font-medium text-neutral-500">О:</span>{" "}
                        {previewText(c.answer_text)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="rounded-md border border-neutral-200 px-2.5 py-1 text-[12px] text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteExisting(c.card_id)}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-[12px] text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editingCardId != null && (
            <div className="mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-800">
              <p className="mb-3 text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                Редактирование карточки #{editingCardId}
              </p>
              <CardSlotEditor
                index={0}
                card={editDraft}
                errors={editErrors}
                onChange={(_, patch) => patchEditDraft(patch)}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => void handleSaveEdit()}
                  className="rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                >
                  Сохранить изменения
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={cancelEdit}
                  className="rounded-md border border-neutral-200 px-4 py-2 text-[13px] text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
            Добавить новые карточки
          </h2>
          {cards.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-[13px] text-neutral-500">
                Нажмите «+ Новая карточка» вверху страницы, чтобы добавить черновики.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cards.map((c, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeSlot(i)}
                      className="text-[12px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                    >
                      Убрать слот
                    </button>
                  </div>
                  <CardSlotEditor
                    index={i}
                    card={c}
                    errors={cardErrors[i]}
                    onChange={handleCardPatch}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Сохранить только новые
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
