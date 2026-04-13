"use client";

import { MatchingModeShell } from "./matching-mode/MatchingModeShell";

/** Режим study: сопоставление вопросов и ответов по теме. */
export function MatchingMode(props: {
  topicId: number;
  pairsParam?: string | null;
  timerParam?: string | null;
  onExit: () => void;
}) {
  return (
    <MatchingModeShell
      learningTopicId={props.topicId}
      pairCountUrlQueryValue={props.pairsParam}
      studyTimerUrlFlag={props.timerParam}
      onExitMatchingStudyFlow={props.onExit}
    />
  );
}
