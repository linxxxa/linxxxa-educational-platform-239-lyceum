"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import CardAnswer from "./CardAnswer";
import CardQuestion from "./CardQuestion";
import DecksInSession from "./DecksInSession";
import EmptyState from "./EmptyState";
import SessionFinished from "./SessionFinished";
import SessionProgress from "./SessionProgress";
import type { Card, SessionState } from "./types";

type Phase = "question" | "answer" | "finished" | "empty" | "loading";

function authHeaders(): HeadersInit {
  const t = getToken();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export default function SessionPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [card, setCard] = useState<Card | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [answerStartTime, setAnswerStartTime] = useState<number>(0);

  const loadNextCard = useCallback(async () => {
    setPhase("loading");
    const res = await fetch("/api/session/next-card", {
      headers: authHeaders(),
    });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    const data = (await res.json()) as {
      finished?: boolean;
      card?: Card | null;
      session?: SessionState | null;
    };

    if (data.finished) {
      setSession(data.session ?? null);
      setPhase("finished");
      return;
    }
    if (!data.card) {
      setSession(data.session ?? null);
      setPhase("empty");
      return;
    }

    setCard(data.card);
    setSession(data.session ?? null);
    setPhase("question");
    setAnswerStartTime(Date.now());
  }, [router]);

  const initSession = useCallback(async () => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    const start = await fetch("/api/session/start", {
      method: "POST",
      headers: authHeaders(),
    });
    if (start.status === 401) {
      router.replace("/login");
      return;
    }
    await loadNextCard();
  }, [loadNextCard, router]);

  useEffect(() => {
    void initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- одна инициализация при монтировании
  }, []);

  const handleShowAnswer = () => {
    setPhase("answer");
  };

  const handleConfidence = async (confidence: "легко" | "средне" | "тяжело") => {
    if (!card) return;

    const response_time_ms = Date.now() - answerStartTime;

    const res = await fetch("/api/session/answer", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        card_id: card.card_id,
        confidence,
        response_time_ms,
        is_correct: true,
      }),
    });

    const data = (await res.json()) as {
      session_finished?: boolean;
      energy?: number;
    };

    if (res.status === 401) {
      router.replace("/login");
      return;
    }

    if (!res.ok) {
      return;
    }

    if (data.session_finished || (data.energy ?? 0) <= 0) {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              energy: data.energy ?? 0,
              cards_done: prev.cards_done + 1,
            }
          : {
              energy: data.energy ?? 0,
              cards_done: 1,
              cards_total: 0,
            }
      );
      setPhase("finished");
      return;
    }

    setSession((prev) =>
      prev
        ? { ...prev, energy: data.energy ?? prev.energy }
        : null
    );
    await loadNextCard();
  };

  if (phase === "loading") {
    return <LoadingCard />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      {session && card && (
        <SessionProgress
          done={session.cards_done}
          total={session.cards_total}
          energy={session.energy}
          topic={card.topic_title}
          subject={card.subject}
        />
      )}

      <div id="decks" className="pt-3">
        <DecksInSession />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[520px]">
          {phase === "question" && card && (
            <CardQuestion card={card} onShowAnswer={handleShowAnswer} />
          )}
          {phase === "answer" && card && (
            <CardAnswer card={card} onConfidence={handleConfidence} />
          )}
          {phase === "empty" && <EmptyState />}
          {phase === "finished" && <SessionFinished session={session} />}
        </div>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="h-48 w-[520px] animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
    </div>
  );
}
