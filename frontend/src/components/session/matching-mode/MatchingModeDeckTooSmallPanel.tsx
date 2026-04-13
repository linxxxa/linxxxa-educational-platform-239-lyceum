/** Сообщение, если в теме слишком мало карточек для matching. */
export function MatchingModeDeckTooSmallPanel() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 text-[13px] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      В колоде мало карточек для сопоставления.
    </div>
  );
}
