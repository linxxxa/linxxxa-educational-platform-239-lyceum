"use client";

import { BlockMath, InlineMath } from "react-katex";

interface LatexPreviewProps {
  latex: string;
  label: string;
}

/**
 * KaTeX только при явных разделителях. Иначе `BlockMath` воспринимает строку как
 * формулу и схлопывает обычные пробелы в русском тексте.
 */
export function LatexPreview({ latex, label }: LatexPreviewProps) {
  const raw = latex ?? "";
  const t = raw.trim();
  if (!t) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/80 px-3 py-6 text-center text-[12px] text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800/50">
        Предпросмотр {label}
      </div>
    );
  }
  if (raw.includes("$$")) {
    const clean = raw.replace(/\$\$/g, "").trim();
    const math = clean.length > 0 ? clean : raw;
    return (
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/80">
        <BlockMath math={math} />
      </div>
    );
  }
  if (
    t.startsWith("$") &&
    t.endsWith("$") &&
    t.length > 2 &&
    !t.slice(1, -1).includes("$")
  ) {
    const inner = t.slice(1, -1);
    return (
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/80">
        <InlineMath math={inner} />
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] leading-relaxed text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-100">
      <p className="whitespace-pre-wrap break-words">{raw}</p>
    </div>
  );
}
