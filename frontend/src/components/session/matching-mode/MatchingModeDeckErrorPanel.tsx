/** Сообщение об ошибке загрузки колоды. */
export function MatchingModeDeckErrorPanel(props: {
  errorMessage: string;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
      {props.errorMessage}
    </div>
  );
}
