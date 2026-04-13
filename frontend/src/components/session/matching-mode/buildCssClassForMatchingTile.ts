import type { MatchingMismatchPair } from "./matchingModeTypes";

/** Проверяет, входит ли плитка в текущую ошибочную пару (подсветка и тряска). */
function computeIsMatchingTileInMismatchHighlight(
  columnSide: "question" | "answer",
  cardId: number,
  activeMismatchPair: MatchingMismatchPair | null
): boolean {
  if (!activeMismatchPair) return false;
  if (columnSide === "question") {
    return activeMismatchPair.questionSideCardId === cardId;
  }
  return activeMismatchPair.answerSideCardId === cardId;
}

/** Базовые Tailwind-классы плитки без анимации тряски. */
function pickBaseTailwindClassForMatchingTile(
  isTileAlreadyMatched: boolean,
  isMismatchHighlight: boolean,
  isTileSelectedInColumn: boolean
): string {
  if (isTileAlreadyMatched) {
    return "is-locked rounded-lg border border-[#10b981]/60 bg-emerald-50/95 px-3 py-2 text-left text-[12px] text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100";
  }
  if (isMismatchHighlight) {
    return "rounded-lg border-2 border-[#ef4444] bg-red-50/90 px-3 py-2 text-left text-[12px] text-red-950 dark:bg-red-950/30 dark:text-red-100";
  }
  if (isTileSelectedInColumn) {
    return "rounded-lg border-2 border-neutral-900 bg-neutral-900 px-3 py-2 text-left text-[12px] text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900";
  }
  return "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-[12px] text-neutral-800 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
}

/**
 * Итоговый className для кнопки-плитки (включая CSS-тряску при ошибке).
 */
export function buildCssClassForMatchingTile(
  columnSide: "question" | "answer",
  cardId: number,
  isTileAlreadyMatched: boolean,
  isTileSelectedInColumn: boolean,
  activeMismatchPair: MatchingMismatchPair | null
): string {
  const isMismatchHighlight = computeIsMatchingTileInMismatchHighlight(
    columnSide,
    cardId,
    activeMismatchPair
  );
  const baseClass = pickBaseTailwindClassForMatchingTile(
    isTileAlreadyMatched,
    isMismatchHighlight,
    isTileSelectedInColumn
  );
  const shakeSuffix = isMismatchHighlight ? " match-tile--shake" : "";
  return `${baseClass}${shakeSuffix}`;
}
