import { getToken } from "@/lib/auth";

export const MATCHING_PENDING_STORAGE_KEY = "edulab_matching_pending_v1";

/** Элемент batch для POST /study/matching-batch-update (алиас `q` → q_value на бэкенде). */
export type MatchingBatchItem = {
  card_id: number;
  q: number;
  mode: "matching";
};

export type MatchingPendingPayload = {
  topic_id: number;
  session_id: string;
  results: MatchingBatchItem[];
  total_response_time_ms: number;
  saved_at: number;
};

export function saveMatchingPending(payload: Omit<MatchingPendingPayload, "saved_at">) {
  const full: MatchingPendingPayload = {
    ...payload,
    saved_at: Date.now(),
  };
  try {
    localStorage.setItem(MATCHING_PENDING_STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* ignore quota */
  }
}

export function loadMatchingPending(): MatchingPendingPayload | null {
  try {
    const raw = localStorage.getItem(MATCHING_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as MatchingPendingPayload;
    if (!p?.results || !Array.isArray(p.results) || !p.topic_id) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearMatchingPending() {
  try {
    localStorage.removeItem(MATCHING_PENDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Приводит элементы из localStorage (q или q_value) к формату для API. */
export function coerceMatchingBatchResultsForApi(
  rawResults: Array<{
    card_id: number;
    q?: number;
    q_value?: number;
    mode?: string;
  }>
): MatchingBatchItem[] {
  return rawResults.map((row) => {
    const explicitQ =
      typeof row.q === "number" && Number.isFinite(row.q)
        ? row.q
        : typeof row.q_value === "number" && Number.isFinite(row.q_value)
          ? row.q_value
          : 3;
    return {
      card_id: row.card_id,
      q: explicitQ,
      mode: "matching",
    };
  });
}

export async function postMatchingBatch(
  body: {
    topic_id: number;
    session_id: string;
    results: MatchingBatchItem[];
    total_response_time_ms: number;
  }
): Promise<Response> {
  const t = getToken();
  return fetch("/api/sessions/batch-update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
