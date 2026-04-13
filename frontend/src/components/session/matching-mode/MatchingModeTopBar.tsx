import { MatchingModeBackButton } from "./MatchingModeBackButton";
import { MatchingModeDeckRefreshButton } from "./MatchingModeDeckRefreshButton";
import { MatchingModeTitleAndSubtitle } from "./MatchingModeTitleAndSubtitle";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Верхняя панель: назад, статус, обновить/перемешать. */
export function MatchingModeTopBar(props: {
  viewModel: MatchingModeViewModel;
  onExitMatchingMode: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <MatchingModeBackButton onExitMatchingMode={props.onExitMatchingMode} />
      <MatchingModeTitleAndSubtitle viewModel={props.viewModel} />
      <MatchingModeDeckRefreshButton viewModel={props.viewModel} />
    </div>
  );
}
