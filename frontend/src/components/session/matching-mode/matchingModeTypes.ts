import type { TopicCardListItem } from "@/lib/api/content";
import type { PairCountOption } from "@/lib/matching-subset";

/** Состояние синхронизации раунда с сервером после завершения всех пар. */
export type MatchingGameSyncPhase =
  | "idle"
  | "admiring"
  | "submitting"
  | "synced"
  | "offline";

/** Краткая сводка ответа batch-эндпоинта для экрана завершения. */
export type MatchingBatchSummary = {
  deltaKnowledgeLevelPoints: number;
  learningEfficiencyPercent: number | null;
  topicKnowledgePercentAfter: number;
};

/** Неверная пара выбранных плиток (для красной линии и тряски). */
export type MatchingMismatchPair = {
  questionSideCardId: number;
  answerSideCardId: number;
};

/** Состояние одного раунда сопоставления (вопросы слева, ответы справа). */
export type MatchingRoundState = {
  phase: "setup" | "play" | "complete";
  pairCountPreset: PairCountOption;
  roundCards: TopicCardListItem[];
  matchedCardIds: number[];
  selectedQuestionCardId: number | null;
  selectedAnswerCardId: number | null;
  mismatchPair: MatchingMismatchPair | null;
  elapsedSecondsInRound: number;
  syncPhase: MatchingGameSyncPhase;
  batchSummary: MatchingBatchSummary | null;
  wrongTouchCountByCardId: Record<number, number>;
};

/** Мета: загрузка колоды с сервера для темы. */
export type MatchingDeckMetaState = {
  isDeckLoading: boolean;
  deckLoadErrorMessage: string | null;
  topicDeckCards: TopicCardListItem[];
};

/** Одна плитка в перемешанной колонке «вопросы» или «ответы». */
export type MatchingShuffledColumnTile = {
  cardId: number;
  previewText: string;
};

/** Один отрезок SVG между центрами плиток на доске. */
export type MatchingBoardLineSegment = {
  segmentKey: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidthPixels: number;
};
