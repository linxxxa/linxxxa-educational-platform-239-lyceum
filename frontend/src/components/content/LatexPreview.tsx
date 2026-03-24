"use client";

import { BlockMath } from "react-katex";

interface LatexPreviewProps {
  latex: string;
  label: string;
}

export function LatexPreview({ latex, label }: LatexPreviewProps) {
  const t = latex.trim();
  if (!t) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/80 px-3 py-6 text-center text-[12px] text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800/50">
        Предпросмотр {label}
      </div>
    );
  }
  try {
    const clean = t.replace(/\$\$/g, "").trim();
    return (
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/80">
        <BlockMath math={clean} />
      </div>
    );
  } catch {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Не удалось отрендерить LaTeX. Проверьте синтаксис.
      </div>
    );
  }
}
