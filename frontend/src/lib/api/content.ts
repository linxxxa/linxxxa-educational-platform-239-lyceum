import { getToken } from "@/lib/auth";
import type {
  DeckBatchSaveRequest,
  LearningSubjectRecord,
  SubjectMetadataTransferObject,
  TopicListItem,
} from "@/types/learning";

function authHeaders(): HeadersInit {
  const t = getToken();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export async function fetchSubjects(): Promise<LearningSubjectRecord[]> {
  const res = await fetch("/api/content/subjects", { headers: authHeaders() });
  if (!res.ok) throw new Error("Не удалось загрузить предметы");
  return res.json() as Promise<LearningSubjectRecord[]>;
}

export async function createSubject(
  payload: SubjectMetadataTransferObject
): Promise<LearningSubjectRecord> {
  const res = await fetch("/api/content/subjects", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const msg =
      typeof e.detail === "string" ? e.detail : "Ошибка создания предмета";
    throw new Error(msg);
  }
  return res.json() as Promise<LearningSubjectRecord>;
}

export async function saveDeckBatch(
  payload: DeckBatchSaveRequest
): Promise<{
  topic_unique_identifier: number;
  cards_created_count: number;
  card_unique_identifiers: number[];
}> {
  const res = await fetch("/api/content/decks/batch", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const msg =
      typeof e.detail === "string" ? e.detail : "Ошибка сохранения колоды";
    throw new Error(msg);
  }
  return res.json() as Promise<{
    topic_unique_identifier: number;
    cards_created_count: number;
    card_unique_identifiers: number[];
  }>;
}

export async function fetchTopics(
  subjectId?: number | null
): Promise<TopicListItem[]> {
  const q =
    subjectId != null ? `?parent_subject_reference_id=${subjectId}` : "";
  const res = await fetch(`/api/content/topics${q}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Не удалось загрузить темы");
  return res.json() as Promise<TopicListItem[]>;
}
