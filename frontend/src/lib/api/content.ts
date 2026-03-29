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

export async function updateTopic(
  topicId: number,
  payload: {
    topic_display_name?: string | null;
    topic_description_text?: string | null;
    parent_subject_reference_id?: number | null;
  }
): Promise<TopicListItem> {
  const res = await fetch(`/api/content/topics/${topicId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const msg =
      typeof e.detail === "string" ? e.detail : "Ошибка обновления колоды";
    throw new Error(msg);
  }
  return res.json() as Promise<TopicListItem>;
}

export async function deleteTopic(topicId: number): Promise<void> {
  const res = await fetch(`/api/content/topics/${topicId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const msg =
      typeof e.detail === "string" ? e.detail : "Ошибка удаления колоды";
    throw new Error(msg);
  }
}

export async function addCardsToTopic(
  topicId: number,
  payload: { new_card_payload_collection: DeckBatchSaveRequest["new_card_payload_collection"] }
): Promise<{ cards_created_count: number; card_unique_identifiers: number[] }> {
  const res = await fetch(`/api/content/topics/${topicId}/cards/batch`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const msg =
      typeof e.detail === "string" ? e.detail : "Ошибка добавления карточек";
    throw new Error(msg);
  }
  return res.json() as Promise<{
    cards_created_count: number;
    card_unique_identifiers: number[];
  }>;
}

function detailMessageFromResponse(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const d = (e as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0] && typeof d[0] === "object") {
    const msg = (d[0] as { msg?: string }).msg;
    if (typeof msg === "string") return msg;
  }
  return null;
}

export async function shareDeckByEmail(
  deckId: number,
  email: string
): Promise<{
  message: string;
  topic_unique_identifier: number;
  cards_copied_count: number;
}> {
  const res = await fetch(`/api/decks/${deckId}/share`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const msg =
      detailMessageFromResponse(e) ?? "Не удалось отправить колоду";
    throw new Error(msg);
  }
  return res.json() as Promise<{
    message: string;
    topic_unique_identifier: number;
    cards_copied_count: number;
  }>;
}
