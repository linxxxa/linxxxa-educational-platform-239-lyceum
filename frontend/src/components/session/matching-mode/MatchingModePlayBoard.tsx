import { MatchingModeAnswerColumn } from "./MatchingModeAnswerColumn";
import { MatchingModeQuestionColumn } from "./MatchingModeQuestionColumn";
import { MatchingModeSvgLineLayer } from "./MatchingModeSvgLineLayer";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Доска: SVG + две колонки плиток. */
export function MatchingModePlayBoard(props: {
  viewModel: MatchingModeViewModel;
}) {
  const { viewModel } = props;
  const boardLockedClass = viewModel.isBoardInteractionLocked
    ? "pointer-events-none select-none opacity-95"
    : "";

  return (
    <div
      ref={viewModel.boardElementRef}
      className={`relative min-h-[280px] rounded-xl border border-neutral-200/80 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80 ${boardLockedClass}`}
    >
      <MatchingModeSvgLineLayer lineSegments={viewModel.lineSegments} />
      <div className="relative z-10 grid gap-4 md:grid-cols-2">
        <MatchingModeQuestionColumn
          viewModel={viewModel}
          questionTiles={viewModel.questionColumnTiles}
        />
        <MatchingModeAnswerColumn
          viewModel={viewModel}
          answerTiles={viewModel.answerColumnTiles}
        />
      </div>
    </div>
  );
}
