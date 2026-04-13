import type { PairCountOption } from "@/lib/matching-subset";
import { computeMaxVisiblePairCountLabel } from "./computeMaxVisiblePairCountLabel";
import { MATCHING_PAIR_COUNT_OPTIONS_LIST } from "./matchingModeConstants";
import { MatchingModePairCountPresetButton } from "./MatchingModePairCountPresetButton";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

/** Экран выбора числа пар и кнопка «Начать». */
export function MatchingModeSetupPanel(props: {
  viewModel: MatchingModeViewModel;
}) {
  const { viewModel } = props;
  const { deckMeta, roundState } = viewModel;
  const maxVisiblePairsLabel = computeMaxVisiblePairCountLabel(
    roundState.pairCountPreset,
    deckMeta.topicDeckCards.length
  );
  const startRoundWithCurrentPreset = () => {
    viewModel.beginPlayRoundWithPairCount(roundState.pairCountPreset);
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
        Сколько пар сопоставим?
      </h2>
      <p className="mt-1 text-[12px] text-neutral-500">
        Сначала слабее по освоению, затем порядок перемешивается.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {MATCHING_PAIR_COUNT_OPTIONS_LIST.map(
          (pairCountOption: PairCountOption) => (
            <MatchingModePairCountPresetButton
              key={String(pairCountOption)}
              pairCountOption={pairCountOption}
              totalCardsInTopicDeck={deckMeta.topicDeckCards.length}
              isPresetCurrentlySelected={
                roundState.pairCountPreset === pairCountOption
              }
              onSelectThisPairCountPreset={() =>
                viewModel.updatePairCountPresetForSetup(pairCountOption)
              }
            />
          )
        )}
      </div>
      <button
        type="button"
        disabled={deckMeta.topicDeckCards.length < 3}
        onClick={startRoundWithCurrentPreset}
        className="mt-6 rounded-md bg-[#2F3437] px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        Начать (
        {roundState.pairCountPreset === "all" ? "все" : roundState.pairCountPreset}{" "}
        пар · до {maxVisiblePairsLabel})
      </button>
    </div>
  );
}
