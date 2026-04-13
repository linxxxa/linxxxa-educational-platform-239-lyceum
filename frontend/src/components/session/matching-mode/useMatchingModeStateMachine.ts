import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { PairCountOption } from "@/lib/matching-subset";
import { getShuffledSubset } from "@/lib/matching-subset";
import type { MatchingBatchItem } from "@/lib/matching-batch-sync";
import { applySuccessfulPairToMatchingRoundState } from "./applySuccessfulPairToMatchingRoundState";
import { applyWrongPairAttemptToMatchingRoundState } from "./applyWrongPairAttemptToMatchingRoundState";
import {
  buildShuffledAnswerColumnTiles,
  buildShuffledQuestionColumnTiles,
} from "./buildShuffledMatchingColumnTiles";
import { computeIsMatchingBoardInputLocked } from "./computeIsMatchingBoardInputLocked";
import { computeMatchingBoardLineSegments } from "./computeMatchingBoardLineSegments";
import { createEmptyMatchingRoundState } from "./createEmptyMatchingRoundState";
import { fetchFilteredDeckForMatchingTopic } from "./fetchFilteredDeckForMatchingTopic";
import { formatElapsedSecondsForTimerDisplay } from "./formatElapsedSecondsForTimerDisplay";
import type {
  MatchingBoardLineSegment,
  MatchingDeckMetaState,
  MatchingRoundState,
  MatchingShuffledColumnTile,
} from "./matchingModeTypes";
import { parsePairCountOptionFromUrlValue } from "./parsePairCountOptionFromUrlValue";
import { resetMatchingSessionAfterDeckReload } from "./resetMatchingSessionAfterDeckReload";
import { submitCompletedMatchingRoundToServer } from "./submitCompletedMatchingRoundToServer";

export type MatchingModeViewModel = {
  deckMeta: MatchingDeckMetaState;
  roundState: MatchingRoundState;
  lineSegments: MatchingBoardLineSegment[];
  questionColumnTiles: MatchingShuffledColumnTile[];
  answerColumnTiles: MatchingShuffledColumnTile[];
  isStudyTimerEnabled: boolean;
  minutesTwoDigits: string;
  secondsTwoDigits: string;
  isTopicDeckTooSmall: boolean;
  isBoardInteractionLocked: boolean;
  boardElementRef: RefObject<HTMLDivElement | null>;
  bindQuestionTileRef: (
    cardId: number,
    element: HTMLButtonElement | null
  ) => void;
  bindAnswerTileRef: (
    cardId: number,
    element: HTMLButtonElement | null
  ) => void;
  reloadTopicDeckFromServer: () => Promise<void>;
  beginPlayRoundWithPairCount: (pairCountChoice: PairCountOption) => void;
  reshuffleCurrentRoundKeepingPairCount: () => void;
  toggleSelectQuestionTile: (cardId: number) => void;
  toggleSelectAnswerTile: (cardId: number) => void;
  updatePairCountPresetForSetup: (nextPreset: PairCountOption) => void;
};

function bindTileRefToMap(
  refMap: MutableRefObject<Map<number, HTMLButtonElement>>,
  cardId: number,
  element: HTMLButtonElement | null
): void {
  if (element) refMap.current.set(cardId, element);
  else refMap.current.delete(cardId);
}

/**
 * Состояние, эффекты и обработчики режима «Сопоставление» для экрана study.
 */
export function useMatchingModeStateMachine(
  learningTopicId: number,
  pairCountUrlQueryValue: string | null | undefined,
  isStudyTimerEnabled: boolean,
  onMatchingBatchSuccessfullySynced?: () => void
): MatchingModeViewModel {
  const onBatchSyncedRef = useRef(onMatchingBatchSuccessfullySynced);
  onBatchSyncedRef.current = onMatchingBatchSuccessfullySynced;

  const [deckMeta, setDeckMeta] = useState<MatchingDeckMetaState>({
    isDeckLoading: true,
    deckLoadErrorMessage: null,
    topicDeckCards: [],
  });

  const [roundState, setRoundState] = useState<MatchingRoundState>(() =>
    createEmptyMatchingRoundState(
      parsePairCountOptionFromUrlValue(pairCountUrlQueryValue)
    )
  );

  const boardElementRef = useRef<HTMLDivElement>(null);
  const questionTileButtonRefs = useRef<Map<number, HTMLButtonElement>>(
    new Map()
  );
  const answerTileButtonRefs = useRef<Map<number, HTMLButtonElement>>(
    new Map()
  );
  const matchingResultsBatchRef = useRef<MatchingBatchItem[]>([]);
  const admireGenerationCounterRef = useRef(0);
  const studySessionIdRef = useRef<string | null>(null);
  const persistedPairCountOptionRef = useRef<PairCountOption>(10);
  const elapsedSecondsMirrorRef = useRef(0);

  const [lineSegments, setLineSegments] = useState<MatchingBoardLineSegment[]>(
    []
  );

  // Подстраиваем пресет числа пар под query-параметр страницы study.
  useEffect(() => {
    const parsedPreset = parsePairCountOptionFromUrlValue(
      pairCountUrlQueryValue
    );
    setRoundState((previous) => ({ ...previous, pairCountPreset: parsedPreset }));
  }, [pairCountUrlQueryValue]);

  // Полная перезагрузка отфильтрованной колоды темы с API.
  const reloadTopicDeckFromServer = useCallback(async () => {
    if (!Number.isFinite(learningTopicId) || learningTopicId <= 0) return;
    setDeckMeta((previous) => ({
      ...previous,
      isDeckLoading: true,
      deckLoadErrorMessage: null,
    }));
    try {
      const filteredDeck = await fetchFilteredDeckForMatchingTopic(
        learningTopicId
      );
      setDeckMeta({
        isDeckLoading: false,
        deckLoadErrorMessage: null,
        topicDeckCards: filteredDeck,
      });
      resetMatchingSessionAfterDeckReload(
        admireGenerationCounterRef,
        matchingResultsBatchRef,
        studySessionIdRef,
        setRoundState,
        setLineSegments
      );
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error ? caughtError.message : "Ошибка загрузки";
      setDeckMeta({
        isDeckLoading: false,
        deckLoadErrorMessage: errorMessage,
        topicDeckCards: [],
      });
    }
  }, [learningTopicId]);

  useEffect(() => {
    void reloadTopicDeckFromServer();
  }, [reloadTopicDeckFromServer]);

  // Секундомер раунда (только в фазе play и если включён флаг таймера).
  useEffect(() => {
    if (!isStudyTimerEnabled || roundState.phase !== "play") return;
    const intervalId = window.setInterval(() => {
      setRoundState((previous) =>
        previous.phase === "play"
          ? {
              ...previous,
              elapsedSecondsInRound: previous.elapsedSecondsInRound + 1,
            }
          : previous
      );
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isStudyTimerEnabled, roundState.phase]);

  // Копия секунд в ref — для чтения внутри отложенного submit без устаревшего замыкания.
  elapsedSecondsMirrorRef.current = roundState.elapsedSecondsInRound;

  const questionColumnTiles = useMemo(
    () => buildShuffledQuestionColumnTiles(roundState.roundCards),
    [roundState.roundCards]
  );
  const answerColumnTiles = useMemo(
    () => buildShuffledAnswerColumnTiles(roundState.roundCards),
    [roundState.roundCards]
  );

  const paintMatchingBoardLineSegments = useCallback(() => {
    const nextSegments = computeMatchingBoardLineSegments(
      boardElementRef.current,
      roundState.phase,
      roundState.matchedCardIds,
      roundState.mismatchPair,
      questionTileButtonRefs.current,
      answerTileButtonRefs.current
    );
    setLineSegments(nextSegments);
  }, [
    roundState.phase,
    roundState.matchedCardIds,
    roundState.mismatchPair,
  ]);

  // Пересчёт линий при изменении совпадений/ошибки и при resize окна.
  useEffect(() => {
    paintMatchingBoardLineSegments();
    window.addEventListener("resize", paintMatchingBoardLineSegments);
    return () =>
      window.removeEventListener("resize", paintMatchingBoardLineSegments);
  }, [
    paintMatchingBoardLineSegments,
    questionColumnTiles.length,
    answerColumnTiles.length,
  ]);

  // Реакция на выбор двух плиток: верная пара, неверная (сброс через 500 мс).
  useEffect(() => {
    const questionPick = roundState.selectedQuestionCardId;
    const answerPick = roundState.selectedAnswerCardId;
    if (questionPick == null || answerPick == null) return;

    if (questionPick === answerPick) {
      setRoundState((previous) =>
        applySuccessfulPairToMatchingRoundState(
          previous,
          questionPick,
          matchingResultsBatchRef
        )
      );
      return;
    }

    setRoundState((previous) =>
      applyWrongPairAttemptToMatchingRoundState(
        previous,
        questionPick,
        answerPick
      )
    );

    const clearWrongSelectionTimer = window.setTimeout(() => {
      setRoundState((previous) => ({
        ...previous,
        selectedQuestionCardId: null,
        selectedAnswerCardId: null,
        mismatchPair: null,
      }));
    }, 500);
    return () => window.clearTimeout(clearWrongSelectionTimer);
  }, [roundState.selectedQuestionCardId, roundState.selectedAnswerCardId]);

  // Все пары собраны: пауза «admire», затем один batch на сервер.
  useEffect(() => {
    if (roundState.phase !== "play" || roundState.roundCards.length === 0) {
      return;
    }
    if (
      roundState.matchedCardIds.length !== roundState.roundCards.length
    ) {
      return;
    }
    setRoundState((previous) => ({ ...previous, syncPhase: "admiring" }));
    const admireGenerationWhenScheduled = admireGenerationCounterRef.current;

    const admireDelayTimerId = window.setTimeout(() => {
      if (admireGenerationWhenScheduled !== admireGenerationCounterRef.current) {
        return;
      }
      setRoundState((previous) => ({ ...previous, syncPhase: "submitting" }));
      void (async () => {
        if (admireGenerationWhenScheduled !== admireGenerationCounterRef.current) {
          return;
        }
        const serverOutcome = await submitCompletedMatchingRoundToServer(
          learningTopicId,
          studySessionIdRef.current ?? "",
          matchingResultsBatchRef.current,
          Math.max(1000, elapsedSecondsMirrorRef.current * 1000)
        );
        if (serverOutcome.outcomeKind === "synced") {
          setRoundState((previous) => ({
            ...previous,
            phase: "complete",
            syncPhase: "synced",
            batchSummary: serverOutcome.batchSummary,
          }));
          queueMicrotask(() => {
            onBatchSyncedRef.current?.();
          });
        } else {
          setRoundState((previous) => ({
            ...previous,
            phase: "complete",
            syncPhase: "offline",
            batchSummary: null,
          }));
        }
        window.dispatchEvent(new CustomEvent("edulab-dashboard-refresh"));
      })();
    }, 1000);
    return () => window.clearTimeout(admireDelayTimerId);
  }, [
    learningTopicId,
    roundState.phase,
    roundState.roundCards.length,
    roundState.matchedCardIds.length,
  ]);

  const beginPlayRoundWithPairCount = useCallback(
    (pairCountChoice: PairCountOption) => {
      if (deckMeta.topicDeckCards.length < 3) return;
      persistedPairCountOptionRef.current = pairCountChoice;
      studySessionIdRef.current = crypto.randomUUID();
      admireGenerationCounterRef.current += 1;
      matchingResultsBatchRef.current = [];
      setRoundState({
        phase: "play",
        pairCountPreset: pairCountChoice,
        roundCards: getShuffledSubset(deckMeta.topicDeckCards, pairCountChoice),
        matchedCardIds: [],
        selectedQuestionCardId: null,
        selectedAnswerCardId: null,
        mismatchPair: null,
        elapsedSecondsInRound: 0,
        syncPhase: "idle",
        batchSummary: null,
        wrongTouchCountByCardId: {},
      });
    },
    [deckMeta.topicDeckCards]
  );

  const reshuffleCurrentRoundKeepingPairCount = useCallback(() => {
    if (roundState.phase !== "play" || deckMeta.topicDeckCards.length === 0) {
      return;
    }
    studySessionIdRef.current = crypto.randomUUID();
    admireGenerationCounterRef.current += 1;
    matchingResultsBatchRef.current = [];
    setRoundState((previous) => ({
      ...previous,
      roundCards: getShuffledSubset(
        deckMeta.topicDeckCards,
        persistedPairCountOptionRef.current
      ),
      matchedCardIds: [],
      selectedQuestionCardId: null,
      selectedAnswerCardId: null,
      mismatchPair: null,
      elapsedSecondsInRound: 0,
      syncPhase: "idle",
      batchSummary: null,
      wrongTouchCountByCardId: {},
    }));
  }, [deckMeta.topicDeckCards, roundState.phase]);

  const bindQuestionTileRef = useCallback(
    (cardId: number, element: HTMLButtonElement | null) => {
      bindTileRefToMap(questionTileButtonRefs, cardId, element);
    },
    []
  );

  const bindAnswerTileRef = useCallback(
    (cardId: number, element: HTMLButtonElement | null) => {
      bindTileRefToMap(answerTileButtonRefs, cardId, element);
    },
    []
  );

  const toggleSelectQuestionTile = useCallback((cardId: number) => {
    setRoundState((previous) => ({
      ...previous,
      selectedQuestionCardId:
        previous.selectedQuestionCardId === cardId ? null : cardId,
    }));
  }, []);

  const toggleSelectAnswerTile = useCallback((cardId: number) => {
    setRoundState((previous) => ({
      ...previous,
      selectedAnswerCardId:
        previous.selectedAnswerCardId === cardId ? null : cardId,
    }));
  }, []);

  const updatePairCountPresetForSetup = useCallback(
    (nextPreset: PairCountOption) => {
      setRoundState((previous) => ({
        ...previous,
        pairCountPreset: nextPreset,
      }));
    },
    []
  );

  const { minutesTwoDigits, secondsTwoDigits } =
    formatElapsedSecondsForTimerDisplay(roundState.elapsedSecondsInRound);

  const isTopicDeckTooSmall =
    !deckMeta.isDeckLoading && deckMeta.topicDeckCards.length < 3;

  const isBoardInteractionLocked =
    computeIsMatchingBoardInputLocked(roundState);

  return {
    deckMeta,
    roundState,
    lineSegments,
    questionColumnTiles,
    answerColumnTiles,
    isStudyTimerEnabled,
    minutesTwoDigits,
    secondsTwoDigits,
    isTopicDeckTooSmall,
    isBoardInteractionLocked,
    boardElementRef,
    bindQuestionTileRef,
    bindAnswerTileRef,
    reloadTopicDeckFromServer,
    beginPlayRoundWithPairCount,
    reshuffleCurrentRoundKeepingPairCount,
    toggleSelectQuestionTile,
    toggleSelectAnswerTile,
    updatePairCountPresetForSetup,
  };
}
