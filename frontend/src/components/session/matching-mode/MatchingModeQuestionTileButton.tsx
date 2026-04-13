import { buildCssClassForMatchingTile } from "./buildCssClassForMatchingTile";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Плитка вопроса в левой колонке. */
export function MatchingModeQuestionTileButton(props: {
  viewModel: MatchingModeViewModel;
  cardId: number;
  previewText: string;
}) {
  const { viewModel, cardId, previewText } = props;
  const { roundState, isBoardInteractionLocked, bindQuestionTileRef } =
    viewModel;
  const isMatched = roundState.matchedCardIds.includes(cardId);
  const isSelected = roundState.selectedQuestionCardId === cardId;
  const className = buildCssClassForMatchingTile(
    "question",
    cardId,
    isMatched,
    isSelected,
    roundState.mismatchPair
  );
  const onTileClick = () => {
    if (isMatched || isBoardInteractionLocked) return;
    viewModel.toggleSelectQuestionTile(cardId);
  };

  return (
    <button
      type="button"
      ref={(element) => bindQuestionTileRef(cardId, element)}
      disabled={isMatched || isBoardInteractionLocked}
      onClick={onTileClick}
      className={className}
    >
      {previewText}
    </button>
  );
}
