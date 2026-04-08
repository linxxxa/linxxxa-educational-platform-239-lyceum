import { getToken } from "@/lib/auth";

export async function fetchDeckSharePreview(token: string): Promise<unknown> {
  const res = await fetch(
    `/api/content/share/${encodeURIComponent(token)}/preview`,
    { cache: "no-store" }
  );
  return res.json();
}

export async function acceptDeckShareToken(token: string): Promise<{
  message: string;
  cloned_topic_unique_identifier: number;
  cards_copied_count: number;
}> {
  const t = getToken();
  if (!t) {
    throw new Error("Нужна авторизация");
  }
  const res = await fetch(
    `/api/content/share/${encodeURIComponent(token)}/accept`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    }
  );
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const msg =
      typeof e.detail === "string"
        ? e.detail
        : "Не удалось принять приглашение";
    throw new Error(msg);
  }
  return res.json() as Promise<{
    message: string;
    cloned_topic_unique_identifier: number;
    cards_copied_count: number;
  }>;
}
