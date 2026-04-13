import { MatchingModeQuestionTileButton } from "./MatchingModeQuestionTileButton";
import type { MatchingShuffledColumnTile } from "./matchingModeTypes";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Левая колонка с перемешанными вопросами. */
export function MatchingModeQuestionColumn(props: {
  viewModel: MatchingModeViewModel;
  questionTiles: MatchingShuffledColumnTile[];
}) {
  return (
    <div className="rounded-xl border border-transparent bg-white/95 p-3 dark:bg-neutral-900/95">
      <div className="mb-3 text-[11px] font-medium text-neutral-500">
        Вопросы
      </div>
      <div className="grid gap-2">
        {props.questionTiles.map((tile) => (
          <MatchingModeQuestionTileButton
            key={tile.cardId}
            viewModel={props.viewModel}
            cardId={tile.cardId}
            previewText={tile.previewText}
          />
        ))}
      </div>
    </div>
  );
}
