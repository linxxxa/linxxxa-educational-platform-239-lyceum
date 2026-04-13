import type { PairCountOption } from "@/lib/matching-subset";

/** Подпись «до N» на кнопке старта (учёт лимита загрузки колоды). */
export function computeMaxVisiblePairCountLabel(
  chosenPairCountPreset: PairCountOption,
  totalCardsInTopicDeck: number
): number {
  if (chosenPairCountPreset === "all") {
    return Math.min(totalCardsInTopicDeck, 400);
  }
  return chosenPairCountPreset;
}
