import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Confidence = "легко" | "средне" | "тяжело";

function confidenceToScore(c: Confidence): number {
  if (c === "легко") return 5;
  if (c === "средне") return 4;
  return 3;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    card_id: number;
    confidence: Confidence;
    response_time_ms: number;
    is_correct: boolean;
    user_answer?: string;
    current_session_energy?: number;
  };

  const payload = {
    target_card_unique_identifier: body.card_id,
    submitted_user_answer_is_correct: body.is_correct,
    user_subjective_confidence_score: confidenceToScore(body.confidence),
    response_thinking_time_seconds: (body.response_time_ms ?? 0) / 1000,
    user_answer: body.user_answer ?? "",
    current_session_energy: body.current_session_energy ?? null,
  };

  const res = await fetch(`${API_BASE}/study/process-answer`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

