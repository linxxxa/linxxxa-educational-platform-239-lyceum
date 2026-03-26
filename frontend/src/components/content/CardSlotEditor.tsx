"use client";

import { useLayoutEffect, useRef } from "react";
import type { CardPayloadItem, CardTypeCategoryProtocol } from "@/types/learning";
import { LatexPreview } from "./LatexPreview";

interface CardSlotEditorProps {
  index: number;
  card: CardPayloadItem;
  errors?: { question?: string; answer?: string };
  onChange: (
    index: number,
    patch: Partial<CardPayloadItem>
  ) => void;
}

const CARD_TYPE_LABELS: Record<CardTypeCategoryProtocol, string> = {
  FORMULA: "Формула",
  CONCEPT: "Понятие",
  TASK: "Задача",
};

function AutoResizeTextarea({
  value,
  onChange,
  className,
  placeholder,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 100)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={1}
      aria-invalid={ariaInvalid}
      className={className}
      placeholder={placeholder}
    />
  );
}

/** handle_card_content_change — обновление текста карточки по индексу */
export function handle_card_content_change(
  index: number,
  patch: Partial<CardPayloadItem>,
  collection: CardPayloadItem[],
  setCollection: (next: CardPayloadItem[]) => void
) {
  const next = [...collection];
  next[index] = { ...next[index], ...patch };
  setCollection(next);
}

export function CardSlotEditor({
  index,
  card,
  errors,
  onChange,
}: CardSlotEditorProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-neutral-500">
          Карточка {index + 1}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-500">Тип</span>
            <select
              value={card.card_type_category}
              onChange={(e) =>
                onChange(index, {
                  card_type_category: e.target
                    .value as CardTypeCategoryProtocol,
                })
              }
              className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] dark:border-neutral-700 dark:bg-neutral-900"
            >
              {(Object.keys(CARD_TYPE_LABELS) as CardTypeCategoryProtocol[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {CARD_TYPE_LABELS[k]}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            Вопрос
          </label>
          <AutoResizeTextarea
            value={card.card_content_question_latex}
            onChange={(e) =>
              onChange(index, {
                card_content_question_latex: e.target.value,
              })
            }
            aria-invalid={Boolean(errors?.question)}
            className={`min-h-[100px] w-full resize-y rounded-md border px-3 py-2 text-[13px] outline-none focus:border-neutral-400 dark:bg-neutral-950 ${
              errors?.question
                ? "border-red-400"
                : "border-neutral-200 dark:border-neutral-700"
            }`}
            placeholder="Например: Напряженность поля точечного заряда $E = \ldots$"
          />
          {errors?.question && (
            <p className="mt-1 text-[11px] text-red-500">{errors.question}</p>
          )}
          <p className="mt-1 text-[11px] text-neutral-500">
            Предпросмотр (KaTeX)
          </p>
          <div className="mt-1">
            <LatexPreview
              latex={card.card_content_question_latex}
              label="вопроса"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            Ответ
          </label>
          <AutoResizeTextarea
            value={card.card_content_answer_latex}
            onChange={(e) =>
              onChange(index, {
                card_content_answer_latex: e.target.value,
              })
            }
            aria-invalid={Boolean(errors?.answer)}
            className={`min-h-[100px] w-full resize-y rounded-md border px-3 py-2 text-[13px] outline-none focus:border-neutral-400 dark:bg-neutral-950 ${
              errors?.answer
                ? "border-red-400"
                : "border-neutral-200 dark:border-neutral-700"
            }`}
            placeholder={String.raw`LaTeX ответа, напр. \frac{k|q|}{r^2}`}
          />
          {errors?.answer && (
            <p className="mt-1 text-[11px] text-red-500">{errors.answer}</p>
          )}
          <p className="mt-1 text-[11px] text-neutral-500">
            Предпросмотр (KaTeX)
          </p>
          <div className="mt-1">
            <LatexPreview
              latex={card.card_content_answer_latex}
              label="ответа"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
