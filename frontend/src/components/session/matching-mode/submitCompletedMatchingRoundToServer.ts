import type { MatchingBatchItem } from "@/lib/matching-batch-sync";
import {
  postMatchingBatch,
  saveMatchingPending,
} from "@/lib/matching-batch-sync";
import { fireConfettiForMatchingRoundSuccess } from "./fireConfettiForMatchingRoundSuccess";
import type { MatchingBatchSummary } from "./matchingModeTypes";
import { parseMatchingBatchResponseJsonToSummary } from "./parseMatchingBatchResponseJsonToSummary";

export type CompletedMatchingRoundServerOutcome =
  | { outcomeKind: "synced"; batchSummary: MatchingBatchSummary }
  | { outcomeKind: "offline" };

/**
 * Отправляет один batch в конце раунда; при сбое сохраняет payload локально.
 */
export async function submitCompletedMatchingRoundToServer(
  topicId: number,
  studySessionId: string,
  matchingBatchItems: MatchingBatchItem[],
  totalResponseTimeMilliseconds: number
): Promise<CompletedMatchingRoundServerOutcome> {
  const requestBody = {
    topic_id: topicId,
    session_id: studySessionId,
    results: matchingBatchItems,
    total_response_time_ms: totalResponseTimeMilliseconds,
  };
  try {
    const httpResponse = await postMatchingBatch(requestBody);
    if (!httpResponse.ok) throw new Error(String(httpResponse.status));
    const responseJson = (await httpResponse.json()) as Record<
      string,
      unknown
    >;
    const batchSummary = parseMatchingBatchResponseJsonToSummary(responseJson);
    window.setTimeout(() => {
      fireConfettiForMatchingRoundSuccess();
    }, 120);
    return { outcomeKind: "synced", batchSummary };
  } catch {
    saveMatchingPending(requestBody);
    window.setTimeout(() => {
      fireConfettiForMatchingRoundSuccess();
    }, 120);
    return { outcomeKind: "offline" };
  }
}
