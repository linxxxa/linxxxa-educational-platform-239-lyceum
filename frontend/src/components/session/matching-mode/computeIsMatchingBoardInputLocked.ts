import type { MatchingRoundState } from "./matchingModeTypes";

/** Блокирует клики по плиткам во время финальной фазы и отправки batch. */
export function computeIsMatchingBoardInputLocked(
  roundState: MatchingRoundState
): boolean {
  if (roundState.phase === "complete") return true;
  if (roundState.syncPhase === "admiring") return true;
  if (roundState.syncPhase === "submitting") return true;
  const roundCardCount = roundState.roundCards.length;
  const matchedCount = roundState.matchedCardIds.length;
  const allPairsConnectedInPlayMode =
    roundState.phase === "play" &&
    matchedCount === roundCardCount &&
    roundCardCount > 0;
  return allPairsConnectedInPlayMode;
}
