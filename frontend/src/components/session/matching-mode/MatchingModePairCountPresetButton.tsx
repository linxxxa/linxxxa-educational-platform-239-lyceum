import type { PairCountOption } from "@/lib/matching-subset";

/** Одна кнопка выбора числа пар (5 / 10 / 15 / все). */
export function MatchingModePairCountPresetButton(props: {
  pairCountOption: PairCountOption;
  totalCardsInTopicDeck: number;
  isPresetCurrentlySelected: boolean;
  onSelectThisPairCountPreset: () => void;
}) {
  const {
    pairCountOption,
    totalCardsInTopicDeck,
    isPresetCurrentlySelected,
    onSelectThisPairCountPreset,
  } = props;
  const label = pairCountOption === "all" ? "Все" : String(pairCountOption);
  const isDisabledBecauseDeckTooSmall =
    pairCountOption !== "all" &&
    typeof pairCountOption === "number" &&
    totalCardsInTopicDeck < pairCountOption;

  return (
    <button
      type="button"
      disabled={isDisabledBecauseDeckTooSmall}
      onClick={onSelectThisPairCountPreset}
      className={`rounded-lg border px-3 py-2 text-[12px] font-medium ${
        isPresetCurrentlySelected
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
          : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
      }`}
    >
      {label}
    </button>
  );
}
