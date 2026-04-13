import { matchingQualityFromWrongTouches } from "@/lib/matching-q";
import type { MatchingBatchItem } from "@/lib/matching-batch-sync";
import type { MatchingRoundState } from "./matchingModeTypes";

type MutableBatchRef = { current: MatchingBatchItem[] };

/**
 * Обновляет состояние после верного сопоставления; дополняет ref батча для сервера.
 */
export function applySuccessfulPairToMatchingRoundState(
  previousRoundState: MatchingRoundState,
  matchedCardId: number,
  matchingResultsBatchRef: MutableBatchRef
): MatchingRoundState {
  const priorWrongTouches =
    previousRoundState.wrongTouchCountByCardId[matchedCardId] ?? 0;
  const explicitQualityQ =
    matchingQualityFromWrongTouches(priorWrongTouches);
  matchingResultsBatchRef.current.push({
    card_id: matchedCardId,
    q: explicitQualityQ,
    mode: "matching",
  });
  const nextMatchedList = previousRoundState.matchedCardIds.includes(
    matchedCardId
  )
    ? previousRoundState.matchedCardIds
    : [...previousRoundState.matchedCardIds, matchedCardId];
  return {
    ...previousRoundState,
    matchedCardIds: nextMatchedList,
    selectedQuestionCardId: null,
    selectedAnswerCardId: null,
    mismatchPair: null,
  };
}
