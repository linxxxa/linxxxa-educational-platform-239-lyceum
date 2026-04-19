import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ topic_id: string; card_id: string }> }
) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { topic_id, card_id } = await context.params;
  const body = await req.text();
  const res = await fetch(
    `${API_BASE}/content/topics/${topic_id}/cards/${card_id}`,
    {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body,
    }
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ topic_id: string; card_id: string }> }
) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { topic_id, card_id } = await context.params;
  const res = await fetch(
    `${API_BASE}/content/topics/${topic_id}/cards/${card_id}`,
    {
      method: "DELETE",
      headers: { Authorization: auth },
    }
  );
  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
