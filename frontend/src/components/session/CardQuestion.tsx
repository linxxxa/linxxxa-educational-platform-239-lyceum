"use client";

import { BlockMath } from "react-katex";
import { answerRedundantWithQuestion, sameCardText } from "@/lib/card-text";
import type { Card } from "./types";

interface Props {
  card: Card;
  onShowAnswer: () => void;
}

function FormulaBlock({ latex }: { latex: string }) {
  const clean = latex.replace(/\$\$/g, "").trim();
  try {
    return <BlockMath math={clean} />;
  } catch {
    return (
      <span className="font-mono text-[14px] text-neutral-700 dark:text-neutral-300">
        {latex}
      </span>
    );
  }
}

export default function CardQuestion({ card, onShowAnswer }: Props) {
  const formulaAnswerRedundant =
    card.card_type === "формула" &&
    (sameCardText(card.question_text, card.answer_text) ||
      answerRedundantWithQuestion(card.question_text, card.answer_text));

  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-7 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[12px] capitalize text-neutral-500">
          {card.card_type}
        </span>
      </div>

      {formulaAnswerRedundant ? (
        sameCardText(card.question_text, card.answer_text) ? (
          <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
            <FormulaBlock latex={card.answer_text} />
          </div>
        ) : (
          <p className="mb-6 break-words text-[16px] leading-relaxed text-neutral-900 dark:text-neutral-100">
            {card.question_text}
          </p>
        )
      ) : (
        <>
          <p className="mb-6 break-words text-[16px] leading-relaxed text-neutral-900 dark:text-neutral-100">
            {card.question_text}
          </p>

          {card.card_type === "формула" && (
            <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
              <FormulaBlock latex={card.answer_text} />
            </div>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onShowAnswer}
        className="w-full rounded-md bg-[#2F3437] py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-[0.85]"
      >
        Показать ответ →
      </button>

      <div className="mt-6 flex justify-between text-[12px] text-neutral-500">
        <button type="button" className="hover:text-neutral-900 dark:hover:text-neutral-100">
          ← Предыдущая
        </button>
        <button type="button" className="hover:text-neutral-900 dark:hover:text-neutral-100">
          Пропустить →
        </button>
      </div>
    </div>
  );
}
