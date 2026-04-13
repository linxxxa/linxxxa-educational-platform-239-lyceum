import { MatchingModeCompletionSummaryBlock } from "./MatchingModeCompletionSummaryBlock";
import type { MatchingRoundState } from "./matchingModeTypes";

/** Модальное окно по завершении раунда. */
export function MatchingModeCompletionModal(props: {
  roundState: MatchingRoundState;
  onFinishSessionNavigateToDashboard: () => void;
}) {
  const { roundState, onFinishSessionNavigateToDashboard } = props;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal
      aria-labelledby="matching-end-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-emerald-200/90 bg-white p-6 shadow-xl dark:border-emerald-800 dark:bg-neutral-900">
        <h2
          id="matching-end-title"
          className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
        >
          Раунд завершён
        </h2>
        {roundState.syncPhase === "offline" ? (
          <p className="mt-3 text-[13px] text-neutral-600 dark:text-neutral-300">
            Нет сети — результат сохранён в браузере и будет отправлен позже.
          </p>
        ) : roundState.batchSummary ? (
          <MatchingModeCompletionSummaryBlock
            batchSummary={roundState.batchSummary}
          />
        ) : (
          <p className="mt-3 text-[13px] text-neutral-600">
            Прогресс синхронизирован.
          </p>
        )}
        <button
          type="button"
          onClick={onFinishSessionNavigateToDashboard}
          className="mt-6 w-full rounded-md bg-[#2F3437] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
        >
          Завершить сессию
        </button>
      </div>
    </div>
  );
}
