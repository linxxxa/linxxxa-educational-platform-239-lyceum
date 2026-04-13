import type { MatchingBatchSummary } from "./matchingModeTypes";

/** Преобразует JSON ответа batch-эндпоинта в сводку для UI. */
export function parseMatchingBatchResponseJsonToSummary(
  responseJson: Record<string, unknown>
): MatchingBatchSummary {
  const deltaRaw = responseJson.delta_knowledge_level;
  const efficiencyRaw = responseJson.learning_efficiency_pct;
  const topicAfterRaw = responseJson.topic_knowledge_after;
  return {
    deltaKnowledgeLevelPoints: Number(deltaRaw ?? 0),
    learningEfficiencyPercent:
      efficiencyRaw != null && Number.isFinite(Number(efficiencyRaw))
        ? Number(efficiencyRaw)
        : null,
    topicKnowledgePercentAfter: Number(topicAfterRaw ?? 0),
  };
}
