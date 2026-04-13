import type { PairCountOption } from "@/lib/matching-subset";
import type { MatchingRoundState } from "./matchingModeTypes";

/** Возвращает пустое состояние раунда при сбросе или до выбора «Начать». */
export function createEmptyMatchingRoundState(
  pairCountPreset: PairCountOption
): MatchingRoundState {
  return {
    phase: "setup",
    pairCountPreset,
    roundCards: [],
    matchedCardIds: [],
    selectedQuestionCardId: null,
    selectedAnswerCardId: null,
    mismatchPair: null,
    elapsedSecondsInRound: 0,
    syncPhase: "idle",
    batchSummary: null,
    wrongTouchCountByCardId: {},
  };
}
