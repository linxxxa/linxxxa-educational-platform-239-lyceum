import type { MatchingBatchSummary } from "./matchingModeTypes";

/** Числовая сводка после успешной синхронизации batch. */
export function MatchingModeCompletionSummaryBlock(props: {
  batchSummary: MatchingBatchSummary;
}) {
  const { batchSummary } = props;
  const delta = batchSummary.deltaKnowledgeLevelPoints;
  const deltaPrefix = delta >= 0 ? "+" : "";

  return (
    <div className="mt-4 space-y-3 text-[13px] text-neutral-700 dark:text-neutral-200">
      <p>
        Уровень знаний темы:{" "}
        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {deltaPrefix}
          {delta.toFixed(1)} п.п.
        </span>{" "}
        (≈ {batchSummary.topicKnowledgePercentAfter.toFixed(0)}%).
      </p>
      {batchSummary.learningEfficiencyPercent != null ? (
        <p>
          Эффективность (η):{" "}
          <span className="font-semibold tabular-nums">
            {batchSummary.learningEfficiencyPercent.toFixed(0)}%
          </span>
        </p>
      ) : null}
      <p className="text-[12px] text-neutral-500">
        Прирост мастерства в matching с коэффициентом 0.7 задаётся на сервере;
        интервалы SM-2 обновлены.
      </p>
    </div>
  );
}
