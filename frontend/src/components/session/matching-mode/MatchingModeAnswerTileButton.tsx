import { buildCssClassForMatchingTile } from "./buildCssClassForMatchingTile";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Плитка ответа в правой колонке. */
export function MatchingModeAnswerTileButton(props: {
  viewModel: MatchingModeViewModel;
  cardId: number;
  previewText: string;
}) {
  const { viewModel, cardId, previewText } = props;
  const { roundState, isBoardInteractionLocked, bindAnswerTileRef } =
    viewModel;
  const isMatched = roundState.matchedCardIds.includes(cardId);
  const isSelected = roundState.selectedAnswerCardId === cardId;
  const className = buildCssClassForMatchingTile(
    "answer",
    cardId,
    isMatched,
    isSelected,
    roundState.mismatchPair
  );
  const onTileClick = () => {
    if (isMatched || isBoardInteractionLocked) return;
    viewModel.toggleSelectAnswerTile(cardId);
  };

  return (
    <button
      type="button"
      ref={(element) => bindAnswerTileRef(cardId, element)}
      disabled={isMatched || isBoardInteractionLocked}
      onClick={onTileClick}
      className={className}
    >
      {previewText}
    </button>
  );
}
