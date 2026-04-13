import { MatchingModeCompletionModal } from "./MatchingModeCompletionModal";
import { MatchingModeDeckErrorPanel } from "./MatchingModeDeckErrorPanel";
import { MatchingModeDeckLoadingSkeleton } from "./MatchingModeDeckLoadingSkeleton";
import { MatchingModeDeckTooSmallPanel } from "./MatchingModeDeckTooSmallPanel";
import { MatchingModePlayBoard } from "./MatchingModePlayBoard";
import { MatchingModeSetupPanel } from "./MatchingModeSetupPanel";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Центральная область: скелетон, ошибка, малый пул, настройка или игра. */
export function MatchingModeMainContent(props: {
  viewModel: MatchingModeViewModel;
  onFinishSessionNavigateToDashboard: () => void;
}) {
  const { viewModel, onFinishSessionNavigateToDashboard } = props;
  const { deckMeta, roundState } = viewModel;

  if (deckMeta.isDeckLoading) {
    return <MatchingModeDeckLoadingSkeleton />;
  }
  if (deckMeta.deckLoadErrorMessage) {
    return (
      <MatchingModeDeckErrorPanel
        errorMessage={deckMeta.deckLoadErrorMessage}
      />
    );
  }
  if (viewModel.isTopicDeckTooSmall) {
    return <MatchingModeDeckTooSmallPanel />;
  }
  if (roundState.phase === "setup") {
    return <MatchingModeSetupPanel viewModel={viewModel} />;
  }

  return (
    <>
      <MatchingModePlayBoard viewModel={viewModel} />
      {roundState.phase === "complete" ? (
        <MatchingModeCompletionModal
          roundState={roundState}
          onFinishSessionNavigateToDashboard={
            onFinishSessionNavigateToDashboard
          }
        />
      ) : null}
    </>
  );
}
