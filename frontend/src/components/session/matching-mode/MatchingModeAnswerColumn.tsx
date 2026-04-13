import { MatchingModeAnswerTileButton } from "./MatchingModeAnswerTileButton";
import type { MatchingShuffledColumnTile } from "./matchingModeTypes";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Правая колонка с перемешанными ответами. */
export function MatchingModeAnswerColumn(props: {
  viewModel: MatchingModeViewModel;
  answerTiles: MatchingShuffledColumnTile[];
}) {
  return (
    <div className="rounded-xl border border-transparent bg-white/95 p-3 dark:bg-neutral-900/95">
      <div className="mb-3 text-[11px] font-medium text-neutral-500">
        Ответы
      </div>
      <div className="grid gap-2">
        {props.answerTiles.map((tile) => (
          <MatchingModeAnswerTileButton
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
