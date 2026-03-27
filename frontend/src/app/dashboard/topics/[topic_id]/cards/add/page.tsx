"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CardPayloadItem } from "@/types/learning";
import { addCardsToTopic } from "@/lib/api/content";
import { validateLatexDelimiters } from "@/lib/latex-validation";
import { CardSlotEditor } from "@/components/content/CardSlotEditor";

function emptyCard(): CardPayloadItem {
  return {
    card_content_question_latex: "",
    card_content_answer_latex: "",
    card_type_category: "CONCEPT",
  };
}

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
      setGeneralError("Добавьте хотя бы одну карточку");
      ok = false;
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
      setGeneralError("Заполните хотя бы одну карточку");
      return;
    }
    setSaving(true);
    try {
      await addCardsToTopic(topicId, { new_card_payload_collection: filled });
      router.push(`/dashboard/topics?focus=${topicId}`);
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [cards, router, topicId]);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-[880px] space-y-6">
        <div className="flex items-center justify-between gap-3">
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
            + Добавить карточку
          </button>
        </div>

        <div>
          <h1 className="text-[22px] font-medium text-neutral-900 dark:text-neutral-100">
            Добавить карточки в колоду
          </h1>
          <p className="text-[13px] text-neutral-500">
            Колода ID: {topicId}
          </p>
        </div>

        {generalError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {generalError}
          </div>
        )}

        {cards.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[13px] text-neutral-500">
              Пока нет карточек. Нажмите «+ Добавить карточку».
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
                    Удалить слот
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
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Сохранить карточки
          </button>
        </div>
      </div>
    </main>
  );
}

