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
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit");
  const q = limit != null && limit !== "" ? `?limit=${encodeURIComponent(limit)}` : "";
  const res = await fetch(`${API_BASE}/content/topics/${topic_id}/cards${q}`, {
    headers: { Authorization: auth },
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

