import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Обновление колоды с сервера (на экране настройки раунда). */
export function MatchingModeDeckRefreshButton(props: {
  viewModel: MatchingModeViewModel;
}) {
  const { viewModel } = props;
  const { roundState } = viewModel;
  if (roundState.phase === "play") {
    return null;
  }
  const isDisabled =
    roundState.phase === "complete" ||
    roundState.syncPhase === "submitting" ||
    roundState.syncPhase === "admiring";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => void viewModel.reloadTopicDeckFromServer()}
      className="rounded-md bg-[#2F3437] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
    >
      Обновить колоду
    </button>
  );
}
