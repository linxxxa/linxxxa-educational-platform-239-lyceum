/** Кнопка выхода из режима сопоставления. */
export function MatchingModeBackButton(props: {
  onExitMatchingMode: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onExitMatchingMode}
      className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-[12px] text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
    >
      ← Назад
    </button>
  );
}
