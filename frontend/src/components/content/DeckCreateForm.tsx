"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { CardPayloadItem } from "@/types/learning";
import {
  createSubject,
  fetchSubjects,
  saveDeckBatch,
} from "@/lib/api/content";
import { getToken } from "@/lib/auth";
import { validateLatexDelimiters } from "@/lib/latex-validation";
import { deckTopicFieldsSchema, type DeckTopicFieldsInput } from "@/lib/validations/deck-topic";
import { AddSubjectModal } from "./AddSubjectModal";
import { CardSlotEditor } from "./CardSlotEditor";

function emptyCard(): CardPayloadItem {
  return {
    card_content_question_latex: "",
    card_content_answer_latex: "",
    card_type_category: "CONCEPT",
  };
}

export function DeckCreateForm() {
  const router = useRouter();
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectOptions, setSubjectOptions] = useState<
    { subject_unique_identifier: number; subject_display_name: string }[]
  >([]);
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [cards, setCards] = useState<CardPayloadItem[]>([]);
  const [cardErrors, setCardErrors] = useState<
    Record<number, { question?: string; answer?: string }>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [subjectPickInit, setSubjectPickInit] = useState(false);

  const {
    register: registerTopic,
    handleSubmit: handleTopicSubmit,
    formState: { errors: topicErrors },
  } = useForm<DeckTopicFieldsInput>({
    resolver: zodResolver(deckTopicFieldsSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { topicTitle: "", topicDesc: "" },
  });

  const loadSubjects = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setSubjectsLoading(true);
    try {
      const list = await fetchSubjects();
      setSubjectOptions(list);
    } catch {
      setGeneralError("Не удалось загрузить предметы");
    } finally {
      setSubjectsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    if (
      !subjectPickInit &&
      subjectOptions.length > 0 &&
      subjectId === ""
    ) {
      setSubjectId(subjectOptions[0].subject_unique_identifier);
      setSubjectPickInit(true);
    }
  }, [subjectOptions, subjectId, subjectPickInit]);

  const handleModalCreateSubject = useCallback(
    async (payload: {
      subject_display_name: string;
      subject_description_text?: string | null;
    }) => {
      const created = await createSubject(payload);
      await loadSubjects();
      setSubjectId(created.subject_unique_identifier);
      setSubjectPickInit(true);
    },
    [loadSubjects]
  );

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

  const validateLatexOnly = (): boolean => {
    const err: Record<number, { question?: string; answer?: string }> = {};
    let ok = true;
    cards.forEach((c, i) => {
      const qe = validateLatexDelimiters(c.card_content_question_latex);
      const ae = validateLatexDelimiters(c.card_content_answer_latex);
      if (qe || ae) {
        err[i] = {
          question: qe ?? undefined,
          answer: ae ?? undefined,
        };
        ok = false;
      }
    });
    setCardErrors(err);
    return ok;
  };

  const handleSubmit = handleTopicSubmit(async (topicValues) => {
    setGeneralError(null);
    if (!validateLatexOnly()) return;

    const sid =
      subjectId === "" || Number.isNaN(Number(subjectId))
        ? null
        : Number(subjectId);
    if (sid === null) {
      setGeneralError(
        "Выберите предмет из списка или нажмите «+ Добавить предмет»."
      );
      return;
    }

    const filled = cards.filter(
      (c) =>
        c.card_content_question_latex.trim() &&
        c.card_content_answer_latex.trim()
    );
    if (filled.length === 0) {
      setGeneralError("Добавьте хотя бы одну карточку с вопросом и ответом");
      return;
    }

    setSaving(true);
    try {
      await saveDeckBatch({
        parent_subject_reference_id: sid,
        topic_title_name: topicValues.topicTitle,
        topic_description_text: topicValues.topicDesc
          ? topicValues.topicDesc
          : null,
        new_card_payload_collection: filled,
      });
      router.push("/dashboard/topics");
    } catch (er) {
      setGeneralError(er instanceof Error ? er.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  });

  if (subjectsLoading) {
    return (
      <div className="w-full max-w-[880px] space-y-4">
        <div className="h-10 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-32 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-48 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      </div>
    );
  }

  return (
    <>
      <AddSubjectModal
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        onSave={handleModalCreateSubject}
      />
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[880px] space-y-8 pb-16"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/dashboard/topics"
            className="text-[13px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ← К темам
          </Link>
        </div>

        {generalError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {generalError}
          </div>
        )}

        {/* Уровень 1 — предмет (контейнер) */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-1 text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
            1. Предмет
          </h2>
          <p className="mb-4 text-[12px] text-neutral-500 dark:text-neutral-400">
            Выберите контейнер для темы и карточек или создайте новый предмет.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
                Предмет
              </label>
              <select
                value={subjectId === "" ? "" : String(subjectId)}
                onChange={(e) =>
                  setSubjectId(e.target.value ? Number(e.target.value) : "")
                }
                className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] dark:border-neutral-700 dark:bg-neutral-950"
              >
                {subjectOptions.length === 0 ? (
                  <option value="">Нет предметов — добавьте первый</option>
                ) : (
                  subjectOptions.map((s) => (
                    <option
                      key={s.subject_unique_identifier}
                      value={s.subject_unique_identifier}
                    >
                      {s.subject_display_name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setSubjectModalOpen(true)}
              className="h-10 shrink-0 rounded-md border border-dashed border-neutral-300 px-4 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              + Добавить предмет
            </button>
          </div>
        </section>

        {/* Уровень 2 — тема / колода */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-1 text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
            2. Тема (колода)
          </h2>
          <p className="mb-4 text-[12px] text-neutral-500 dark:text-neutral-400">
            Название и параметры темы внутри выбранного предмета; тема жёстко
            привязывается к этому предмету в базе.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="topicTitle"
                className="mb-1 block text-[12px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Название темы
              </label>
              <input
                id="topicTitle"
                {...registerTopic("topicTitle")}
                className={`h-10 w-full rounded-md border px-3 text-[13px] dark:bg-neutral-950 ${
                  topicErrors.topicTitle
                    ? "border-red-400 dark:border-red-600"
                    : "border-neutral-200 dark:border-neutral-700"
                }`}
                placeholder="Например: Электростатика"
              />
              {topicErrors.topicTitle?.message ? (
                <p className="mt-1 text-[11px] text-red-500">
                  {topicErrors.topicTitle.message}
                </p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="topicDesc"
                className="mb-1 block text-[12px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Описание темы (необязательно)
              </label>
              <input
                id="topicDesc"
                {...registerTopic("topicDesc")}
                className={`h-10 w-full rounded-md border px-3 text-[13px] dark:bg-neutral-950 ${
                  topicErrors.topicDesc
                    ? "border-red-400 dark:border-red-600"
                    : "border-neutral-200 dark:border-neutral-700"
                }`}
              />
              {topicErrors.topicDesc?.message ? (
                <p className="mt-1 text-[11px] text-red-500">
                  {topicErrors.topicDesc.message}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Уровень 3 — карточки */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
                3. Карточки
              </h2>
              <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
                Вопрос и ответ с LaTeX, предпросмотр KaTeX, сложность и тип.
                При «Сохранить все» карточки записываются пачкой и привязываются к
                созданной теме.
              </p>
            </div>
            <button
              type="button"
              onClick={addSlot}
              className="rounded-md border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              + Добавить карточку
            </button>
          </div>

          {cards.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-10 text-center dark:border-neutral-600 dark:bg-neutral-900/40">
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400">
                Карточек пока нет. Нажмите «+ Добавить карточку», чтобы начать.
              </p>
              <button
                type="button"
                onClick={addSlot}
                className="mt-4 rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
              >
                Добавить первую карточку
              </button>
            </div>
          )}

          {cards.map((card, index) => (
            <div key={index}>
              <CardSlotEditor
                index={index}
                card={card}
                errors={cardErrors[index]}
                onChange={handleCardPatch}
              />
              <button
                type="button"
                onClick={() => removeSlot(index)}
                className="mt-2 text-[12px] text-neutral-500 hover:text-red-600"
              >
                Удалить карточку
              </button>
            </div>
          ))}
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-[#2F3437] py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-[0.85] disabled:opacity-50"
        >
          {saving ? "Сохранение…" : "Сохранить все"}
        </button>
      </form>
    </>
  );
}
