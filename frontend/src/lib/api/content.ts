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

export interface TopicCardListItem {
  card_id: number;
  question_text: string;
  answer_text: string;
  /** 0–100, из прогресса пользователя; по умолчанию 0 */
  mastery_level?: number;
}

export async function fetchCardsInTopic(
  topicId: number,
  limit = 200
): Promise<TopicCardListItem[]> {
  const res = await fetch(
    `/api/content/topics/${topicId}/cards?limit=${encodeURIComponent(String(limit))}`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const msg =
      typeof e.detail === "string" ? e.detail : "Ошибка загрузки карточек";
    throw new Error(msg);
  }
  const j = (await res.json().catch(() => ({}))) as { cards?: unknown };
  const arr = Array.isArray(j.cards) ? j.cards : [];
  return arr
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .map((o) => ({
      card_id: Number(o.card_id) || 0,
      question_text: typeof o.question_text === "string" ? o.question_text : "",
      answer_text: typeof o.answer_text === "string" ? o.answer_text : "",
      mastery_level:
        typeof o.mastery_level === "number" && Number.isFinite(o.mastery_level)
          ? o.mastery_level
          : 0,
    }))
    .filter((c) => c.card_id > 0);
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
  share_url: string;
  recipient_registered: boolean;
  /** false, если на бэкенде не настроен SMTP или отправка не удалась */
  email_sent?: boolean;
  links?: {
    universal: string;
    registered_user_dashboard: string;
    new_user_register: string;
  };
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
    share_url: string;
    recipient_registered: boolean;
    email_sent?: boolean;
    links?: {
      universal: string;
      registered_user_dashboard: string;
      new_user_register: string;
    };
  }>;
}
