import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Обновление колоды с сервера или перемешивание текущего раунда. */
export function MatchingModeDeckRefreshButton(props: {
  viewModel: MatchingModeViewModel;
}) {
  const { viewModel } = props;
  const { roundState } = viewModel;
  const allPairsMatchedInPlayRound =
    roundState.phase === "play" &&
    roundState.roundCards.length > 0 &&
    roundState.matchedCardIds.length === roundState.roundCards.length;
  const isDisabled =
    roundState.phase === "complete" ||
    roundState.syncPhase === "submitting" ||
    roundState.syncPhase === "admiring" ||
    allPairsMatchedInPlayRound;
  const label =
    roundState.phase === "play" ? "Перемешать" : "Обновить колоду";
  const onClick =
    roundState.phase === "play"
      ? viewModel.reshuffleCurrentRoundKeepingPairCount
      : () => void viewModel.reloadTopicDeckFromServer();

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className="rounded-md bg-[#2F3437] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
