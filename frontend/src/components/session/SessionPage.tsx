"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchTopics } from "@/lib/api/content";
import { getToken } from "@/lib/auth";
import CardAnswer from "./CardAnswer";
import CardQuestion from "./CardQuestion";
import DashboardInsights from "./DashboardInsights";
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

function CardSlotSkeleton() {
  return (
    <div className="min-h-[280px] animate-pulse rounded-xl border border-neutral-200 bg-white p-7 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5 h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="mb-4 h-4 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="mb-4 h-4 w-[90%] rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="mt-8 h-10 w-full rounded-lg bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [card, setCard] = useState<Card | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [answerStartTime, setAnswerStartTime] = useState<number>(0);
  const [hasAnyDecks, setHasAnyDecks] = useState(false);
  /** Только самый первый запрос next-card — полноэкранный скелетон не показываем между карточками */
  const [awaitingFirstCard, setAwaitingFirstCard] = useState(true);
  const [fetchingNext, setFetchingNext] = useState(false);
  const [fastTrackPinned, setFastTrackPinned] = useState(false);

  useEffect(() => {
    if (!fastTrackPinned) return;
    const t = window.setTimeout(() => setFastTrackPinned(false), 4500);
    return () => window.clearTimeout(t);
  }, [fastTrackPinned]);

  const loadNextCard = useCallback(
    async (hasDecksOverride?: boolean) => {
      const effectiveHasDecks = hasDecksOverride ?? hasAnyDecks;

      if (awaitingFirstCard) {
        setPhase("loading");
      } else {
        setFetchingNext(true);
      }

      const res = await fetch("/api/session/next-card", {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setAwaitingFirstCard(false);
        setFetchingNext(false);
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as {
        finished?: boolean;
        card?: Card | null;
        session?: SessionState | null;
      };

      setAwaitingFirstCard(false);
      setFetchingNext(false);

      if (data.finished) {
        setSession(data.session ?? null);
        setCard(null);
        setPhase("finished");
        return;
      }
      if (!data.card) {
        setSession(data.session ?? null);
        setCard(null);
        setPhase(effectiveHasDecks ? "finished" : "empty");
        return;
      }

      setCard(data.card);
      setSession(data.session ?? null);
      setPhase("question");
      setAnswerStartTime(Date.now());
    },
    [router, hasAnyDecks, awaitingFirstCard]
  );

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
    let anyDecks = false;
    try {
      const topics = await fetchTopics();
      anyDecks = topics.length > 0;
      setHasAnyDecks(anyDecks);
    } catch {
      // Если список тем не удалось загрузить, оставляем поведение по умолчанию.
    }
    await loadNextCard(anyDecks);
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
      fast_track_week?: boolean;
    };

    if (res.status === 401) {
      router.replace("/login");
      return;
    }

    if (!res.ok) {
      return;
    }

    if (data.fast_track_week) {
      setFastTrackPinned(true);
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
      setCard(null);
      setPhase("finished");
      return;
    }

    setSession((prev) =>
      prev ? { ...prev, energy: data.energy ?? prev.energy } : null
    );
    await loadNextCard();
  };

  const showSessionProgress =
    (phase === "question" || phase === "answer") &&
    session &&
    card &&
    !fetchingNext;

  return (
    <div className="w-full min-w-0 pb-10">
      {fastTrackPinned && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[110] flex max-w-[min(92vw,22rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          <span className="text-base" aria-hidden>
            ⚡
          </span>
          <span>Закреплено! Вернемся через неделю</span>
        </div>
      )}
      <div className="grid w-full gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
        {/* Сначала учёба: прогресс + карточка всегда выше блока инсайтов (мобайл и десктоп) */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          {showSessionProgress && (
            <SessionProgress
              done={session!.cards_done}
              total={session!.cards_total}
              energy={session!.energy}
              topic={card!.topic_title}
              subject={card!.subject}
            />
          )}

          <div className="relative min-h-[200px]">
            {fetchingNext && <CardSlotSkeleton />}
            {!fetchingNext && phase === "loading" && awaitingFirstCard && (
              <CardSlotSkeleton />
            )}
            {!fetchingNext && phase === "question" && card && (
              <CardQuestion card={card} onShowAnswer={handleShowAnswer} />
            )}
            {!fetchingNext && phase === "answer" && card && (
              <CardAnswer card={card} onConfidence={handleConfidence} />
            )}
            {!fetchingNext && phase === "empty" && !hasAnyDecks && (
              <EmptyState />
            )}
            {!fetchingNext && phase === "finished" && (
              <SessionFinished session={session} />
            )}
          </div>
        </div>

        {/* Контекст: уровень знаний, зоны роста, колоды — справа на lg, снизу на мобиле; на десктопе листается отдельно */}
        <aside className="min-w-0 space-y-8 border-t border-neutral-200 pt-8 lg:col-span-5 lg:border-t-0 lg:pt-0 lg:pl-2">
          <div className="lg:sticky lg:top-[calc(3.5rem+0.75rem)] lg:max-h-[calc(100vh-3.5rem-2rem)] lg:space-y-8 lg:overflow-y-auto lg:pb-4">
            <DashboardInsights />
            <DecksInSession />
          </div>
        </aside>
      </div>
    </div>
  );
}
