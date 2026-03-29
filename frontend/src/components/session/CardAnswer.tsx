"use client";

import ConfidenceButtons from "./ConfidenceButtons";
import type { Card } from "./types";

interface Props {
  card: Card;
  onConfidence: (c: "легко" | "средне" | "тяжело") => void;
}

export default function CardAnswer({ card, onConfidence }: Props) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-7 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[12px] capitalize text-neutral-500">
          {card.card_type}
        </span>
      </div>

      <p className="mb-5 break-words text-[15px] leading-relaxed text-neutral-400 dark:text-neutral-500">
        {card.question_text}
      </p>

      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
        <span className="text-[11px] text-neutral-400">Ответ</span>
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
      </div>

      <p className="mb-7 break-words text-[16px] leading-relaxed text-neutral-900 dark:text-neutral-100">
        {card.answer_text}
      </p>

      <ConfidenceButtons onSelect={onConfidence} />
    </div>
  );
}
