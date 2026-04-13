import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { createEmptyMatchingRoundState } from "./createEmptyMatchingRoundState";
import type { MatchingBatchItem } from "@/lib/matching-batch-sync";
import type { MatchingBoardLineSegment, MatchingRoundState } from "./matchingModeTypes";

/** Сбрасывает ref’ы и состояние раунда после успешной подгрузки колоды. */
export function resetMatchingSessionAfterDeckReload(
  admireGenerationCounterRef: MutableRefObject<number>,
  matchingResultsBatchRef: MutableRefObject<MatchingBatchItem[]>,
  studySessionIdRef: MutableRefObject<string | null>,
  setRoundState: Dispatch<SetStateAction<MatchingRoundState>>,
  setLineSegments: Dispatch<SetStateAction<MatchingBoardLineSegment[]>>
): void {
  admireGenerationCounterRef.current += 1;
  matchingResultsBatchRef.current = [];
  studySessionIdRef.current = null;
  setRoundState((previousRound) => ({
    ...createEmptyMatchingRoundState(previousRound.pairCountPreset),
    pairCountPreset: previousRound.pairCountPreset,
  }));
  setLineSegments([]);
}
