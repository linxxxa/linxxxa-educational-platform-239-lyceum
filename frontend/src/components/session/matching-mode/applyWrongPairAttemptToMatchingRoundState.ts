import type { MatchingRoundState } from "./matchingModeTypes";

/**
 * Учитывает неверную попытку: счётчики касаний и пара для красной линии.
 */
export function applyWrongPairAttemptToMatchingRoundState(
  previousRoundState: MatchingRoundState,
  questionSideCardId: number,
  answerSideCardId: number
): MatchingRoundState {
  return {
    ...previousRoundState,
    wrongTouchCountByCardId: {
      ...previousRoundState.wrongTouchCountByCardId,
      [questionSideCardId]:
        (previousRoundState.wrongTouchCountByCardId[
          questionSideCardId
        ] ?? 0) + 1,
      [answerSideCardId]:
        (previousRoundState.wrongTouchCountByCardId[answerSideCardId] ?? 0) +
        1,
    },
    mismatchPair: { questionSideCardId, answerSideCardId },
  };
}
