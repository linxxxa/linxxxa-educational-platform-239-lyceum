import {
  MATCHING_SVG_LINE_STROKE_COLOR_CORRECT_PAIR,
  MATCHING_SVG_LINE_STROKE_COLOR_MISMATCH_PAIR,
} from "./matchingModeConstants";
import type {
  MatchingBoardLineSegment,
  MatchingMismatchPair,
  MatchingRoundState,
} from "./matchingModeTypes";

/** Центр элемента в координатах доски (левый верх доски = 0,0). */
function computeElementCenterRelativeToBoard(
  htmlElement: HTMLElement,
  boardBoundingRect: DOMRectReadOnly
): { x: number; y: number } {
  const elementRect = htmlElement.getBoundingClientRect();
  return {
    x:
      elementRect.left +
      elementRect.width / 2 -
      boardBoundingRect.left,
    y:
      elementRect.top +
      elementRect.height / 2 -
      boardBoundingRect.top,
  };
}

/** Добавляет зелёный отрезок для одной сопоставленной пары. */
function appendCorrectPairSegmentIfBothTilesExist(
  outputSegments: MatchingBoardLineSegment[],
  matchedCardId: number,
  questionButtonByCardId: ReadonlyMap<number, HTMLButtonElement>,
  answerButtonByCardId: ReadonlyMap<number, HTMLButtonElement>,
  boardBoundingRect: DOMRectReadOnly
): void {
  const questionButton = questionButtonByCardId.get(matchedCardId);
  const answerButton = answerButtonByCardId.get(matchedCardId);
  if (!questionButton || !answerButton) return;
  const startPoint = computeElementCenterRelativeToBoard(
    questionButton,
    boardBoundingRect
  );
  const endPoint = computeElementCenterRelativeToBoard(
    answerButton,
    boardBoundingRect
  );
  outputSegments.push({
    segmentKey: `correct-pair-${matchedCardId}`,
    x1: startPoint.x,
    y1: startPoint.y,
    x2: endPoint.x,
    y2: endPoint.y,
    strokeColor: MATCHING_SVG_LINE_STROKE_COLOR_CORRECT_PAIR,
    strokeWidthPixels: 1.5,
  });
}

/** Добавляет красный отрезок для ошибочной пары. */
function appendMismatchPairSegmentIfTilesExist(
  outputSegments: MatchingBoardLineSegment[],
  mismatchPair: MatchingMismatchPair,
  questionButtonByCardId: ReadonlyMap<number, HTMLButtonElement>,
  answerButtonByCardId: ReadonlyMap<number, HTMLButtonElement>,
  boardBoundingRect: DOMRectReadOnly
): void {
  const questionButton = questionButtonByCardId.get(
    mismatchPair.questionSideCardId
  );
  const answerButton = answerButtonByCardId.get(
    mismatchPair.answerSideCardId
  );
  if (!questionButton || !answerButton) return;
  const startPoint = computeElementCenterRelativeToBoard(
    questionButton,
    boardBoundingRect
  );
  const endPoint = computeElementCenterRelativeToBoard(
    answerButton,
    boardBoundingRect
  );
  outputSegments.push({
    segmentKey: "mismatch-pair",
    x1: startPoint.x,
    y1: startPoint.y,
    x2: endPoint.x,
    y2: endPoint.y,
    strokeColor: MATCHING_SVG_LINE_STROKE_COLOR_MISMATCH_PAIR,
    strokeWidthPixels: 3,
  });
}

/**
 * Строит массив отрезков SVG по DOM-позициям плиток (без побочных эффектов).
 */
export function computeMatchingBoardLineSegments(
  boardElement: HTMLDivElement | null,
  gamePhase: MatchingRoundState["phase"],
  matchedCardIds: readonly number[],
  mismatchPair: MatchingMismatchPair | null,
  questionButtonByCardId: ReadonlyMap<number, HTMLButtonElement>,
  answerButtonByCardId: ReadonlyMap<number, HTMLButtonElement>
): MatchingBoardLineSegment[] {
  if (!boardElement || gamePhase === "setup") return [];
  const boardBoundingRect = boardElement.getBoundingClientRect();
  const outputSegments: MatchingBoardLineSegment[] = [];
  for (const matchedCardId of matchedCardIds) {
    appendCorrectPairSegmentIfBothTilesExist(
      outputSegments,
      matchedCardId,
      questionButtonByCardId,
      answerButtonByCardId,
      boardBoundingRect
    );
  }
  if (mismatchPair) {
    appendMismatchPairSegmentIfTilesExist(
      outputSegments,
      mismatchPair,
      questionButtonByCardId,
      answerButtonByCardId,
      boardBoundingRect
    );
  }
  return outputSegments;
}
