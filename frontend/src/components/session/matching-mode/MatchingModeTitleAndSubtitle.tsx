import { MatchingModeStatusSubtitle } from "./MatchingModeStatusSubtitle";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Заголовок «Режим: Сопоставление» и строка статуса. */
export function MatchingModeTitleAndSubtitle(props: {
  viewModel: MatchingModeViewModel;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
        Режим: Сопоставление
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-500">
        <MatchingModeStatusSubtitle viewModel={props.viewModel} />
      </div>
    </div>
  );
}
