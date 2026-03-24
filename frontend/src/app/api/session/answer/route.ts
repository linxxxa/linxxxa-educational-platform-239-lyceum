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
    is_correct?: boolean;
  };

  const payload = {
    target_card_unique_identifier: body.card_id,
    submitted_user_answer_is_correct: body.is_correct ?? true,
    user_subjective_confidence_score: confidenceToScore(body.confidence),
    response_thinking_time_seconds: (body.response_time_ms ?? 0) / 1000,
  };

  const res = await fetch(`${API_BASE}/study/submit-answer`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as {
    session_completed?: boolean;
    energy_left?: number;
    next_review?: string;
    new_mastery?: number;
    detail?: string;
  };

  if (!res.ok) {
    return NextResponse.json(
      { error: data.detail ?? "Ошибка" },
      { status: res.status }
    );
  }

  const energy = Math.max(0, data.energy_left ?? 0);
  const session_finished =
    data.session_completed === true || energy <= 0;

  return NextResponse.json({
    session_finished,
    energy,
    next_review: data.next_review,
    new_mastery: data.new_mastery,
  });
}
