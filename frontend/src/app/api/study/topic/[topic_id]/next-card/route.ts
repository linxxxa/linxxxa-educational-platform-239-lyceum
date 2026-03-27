import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ topic_id: string }> }
) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic_id } = await context.params;
  const incoming = new URL(req.url);
  const url = new URL(`${API_BASE}/study/topic/${topic_id}/next-card`);
  // Для запуска повторения по колоде даже если нет due-карточек:
  // включаем тренировочный режим (include_future=1).
  url.searchParams.set("include_future", "1");
  const exclude = incoming.searchParams.get("exclude_card_ids");
  if (exclude) {
    url.searchParams.set("exclude_card_ids", exclude);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: auth },
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

