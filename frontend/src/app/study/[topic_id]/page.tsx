"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BlockMath, InlineMath } from "react-katex";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { fetchTopics } from "@/lib/api/content";
import { getToken } from "@/lib/auth";
import { answerRedundantWithQuestion, sameCardText } from "@/lib/card-text";
import { formatStudyTimeHours } from "@/lib/format-study-time";

type Confidence = "тяжело" | "средне" | "легко";
/** FSM: Question → Checking → Comparison → Rating → Transition → next card */
type Stage =
  | "QUESTION"
  | "CHECKING"
  | "COMPARISON"
  | "RATING"
  | "TRANSITION"
  | "FINISHED"
  | "EMPTY";

interface StudyCard {
  card_id: number;
  question_text: string;
  answer_text: string;
  explanation_text?: string | null;
  card_type: string;
  topic_title: string;
}

interface SessionState {
  energy: number;
  cards_done: number;
  cards_total: number;
}

interface ProcessAnswerResponse {
  session_completed?: boolean;
  energy_left?: number;
  suggest_break?: boolean;
  fast_track_week?: boolean;
}

interface SessionFinishSummary {
  eta_percent: number;
  delta_ri: number;
  accuracy_correct: number;
  accuracy_total: number;
  accuracy_percent?: number;
  session_minutes: number;
  /** Сумма τ по карточкам (мс), только время до «Проверить». */
  total_response_time_ms?: number;
  ri_before: number;
  ri_after: number;
  /** Динамический уровень знаний 0–100 (как на дашборде), явно от бэкенда. */
  knowledge_level_before?: number;
  knowledge_level_after?: number;
  delta_knowledge_level?: number;
  energy_left: number;
}

interface SessionInteractionRecord {
  is_correct: boolean;
  response_time_ms: number;
  topic_id: number;
}

/** Точность сессии: доля верных от общего числа ответов. */
function formatSessionAccuracyDisplay(
  s: SessionFinishSummary
): { text: string; highlight: boolean } | null {
  const total = s.accuracy_total ?? 0;
  if (total <= 0) return null;
  const correct = s.accuracy_correct ?? 0;
  const pctRaw =
    s.accuracy_percent != null && Number.isFinite(Number(s.accuracy_percent))
      ? Number(s.accuracy_percent)
      : (100 * correct) / total;
  const pct = Math.round(Math.max(0, Math.min(100, pctRaw)));
  return {
    text: `${pct}% (${correct}/${total})`,
    highlight: pct > 50,
  };
}

interface EnergyContextState {
  energy: number;
  setEnergy: (next: number) => void;
}

const StudyEnergyContext = createContext<EnergyContextState | null>(null);

function authHeaders(): HeadersInit {
  const t = getToken();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

function normalizeAnswer(input: string): string {
  return input.replace(/\$\$/g, "").replace(/\$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Ответ уже показан в блоке вопроса — не дублировать в сравнении. */
function answerAlreadyInQuestionBody(card: StudyCard): boolean {
  return (
    sameCardText(card.question_text, card.answer_text) ||
    answerRedundantWithQuestion(card.question_text, card.answer_text)
  );
}

function renderLatexBlock(content: string) {
  const clean = content.replace(/\$\$/g, "").trim();
  return (
    <div className="min-w-0 max-w-full text-center leading-[1.6]">
      <BlockMath math={clean || content} />
    </div>
  );
}

/** Сравнение ответов: при LaTeX рендерим оба варианта. */
function renderAnswerMaybeLatex(text: string, className: string) {
  const t = text.trim();
  if (!t) return <span className="text-neutral-500">—</span>;
  if (t.includes("$$")) {
    const clean = t.replace(/\$\$/g, "").trim();
    return (
      <div className={`overflow-x-auto overflow-y-hidden ${className}`}>
        <BlockMath math={clean || t} />
      </div>
    );
  }
  if (t.startsWith("$") && t.endsWith("$") && t.length > 2) {
    const inner = t.slice(1, -1);
    return (
      <div className={`overflow-x-auto ${className}`}>
        <InlineMath math={inner} />
      </div>
    );
  }
  return <p className={className}>{text}</p>;
}

/** Компактный выход из сессии (без полосы прогресса и энергии). */
function StudyExitButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      onClick={onExit}
      aria-label="Прервать сессию"
      className="fixed right-4 top-[calc(var(--app-header-h)+0.5rem)] z-50 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E4E7] text-xs text-neutral-600 hover:bg-neutral-100 dark:border-[#27272A] dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      ✕
    </button>
  );
}

function SummaryCounter({
  fromRi,
  toRi,
  knowledgeBefore,
  knowledgeAfter,
}: {
  fromRi: number;
  toRi: number;
  knowledgeBefore?: number;
  knowledgeAfter?: number;
}) {
  const toNorm = (
    kb: number | undefined,
    ri: number
  ): number => {
    if (kb != null && Number.isFinite(kb)) {
      return Math.max(0, Math.min(100, Math.round(kb)));
    }
    return Math.max(0, Math.min(100, Math.round(ri / 10)));
  };
  const fromNorm = toNorm(knowledgeBefore, fromRi);
  const [value, setValue] = useState(fromNorm);
  useEffect(() => {
    const fromN = toNorm(knowledgeBefore, fromRi);
    const toN = toNorm(knowledgeAfter, toRi);
    setValue(fromN);
    const start = Date.now();
    const timer = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 700);
      setValue(Math.round(fromN + (toN - fromN) * p));
      if (p >= 1) window.clearInterval(timer);
    }, 30);
    return () => window.clearInterval(timer);
  }, [fromRi, toRi, knowledgeBefore, knowledgeAfter]);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="font-[var(--font-geist-mono)] text-5xl font-medium tabular-nums">
        {value}
      </div>
      <div className="text-sm text-neutral-500">из 100</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mt-1 text-2xl text-neutral-900 dark:text-neutral-100 ${valueClassName ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

/** Суммарное время раздумий (мс) → MM:SS. */
function formatThinkingMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function StudyTopicPage({
  params,
}: {
  params: Promise<{ topic_id: string }>;
}) {
  const router = useRouter();
  const [topicId, setTopicId] = useState("");
  const [session, setSession] = useState<SessionState>({ energy: 100, cards_done: 0, cards_total: 0 });
  const [energy, setEnergy] = useState(100);
  const [card, setCard] = useState<StudyCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("QUESTION");
  const [answerInput, setAnswerInput] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showBreakHint, setShowBreakHint] = useState(false);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [hasAnyDecks, setHasAnyDecks] = useState(false);
  const [summary, setSummary] = useState<SessionFinishSummary | null>(null);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [seenCardIds, setSeenCardIds] = useState<number[]>([]);
  const [fastTrackPinned, setFastTrackPinned] = useState(false);
  const sessionInteractionsRef = useRef<SessionInteractionRecord[]>([]);
  const sessionRiBeforeRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionRef = useRef(session);

  // τ: старт после отрисовки вопроса (двойной rAF); стоп на «Проверить» — дальше время не считается.
  const startTimeRef = useRef<number | null>(null);
  const responseTimeMsRef = useRef<number | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    params.then((p) => setTopicId(p.topic_id));
  }, [params]);

  useEffect(() => {
    if (!fastTrackPinned) return;
    const t = window.setTimeout(() => setFastTrackPinned(false), 4500);
    return () => window.clearTimeout(t);
  }, [fastTrackPinned]);

  const loadNextCard = useCallback(async (excludeIds: number[] = []) => {
    if (!topicId) return;
    setLoading(true);
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const url = new URL(
      `/api/study/topic/${topicId}/next-card`,
      window.location.origin
    );
    if (excludeIds.length > 0) {
      url.searchParams.set("exclude_card_ids", excludeIds.join(","));
    }
    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    const data = (await res.json()) as { finished?: boolean; card?: StudyCard | null; session?: SessionState | null };
    if (data.finished) {
      setStage("FINISHED");
      if (data.session) {
        setSession(data.session);
        setEnergy(data.session.energy);
      }
      setLoading(false);
      return;
    }
    if (!data.card) {
      setCard(null);
      setStage("FINISHED");
      if (data.session) {
        setSession(data.session);
        setEnergy(data.session.energy);
      }
      setLoading(false);
      return;
    }
    setCard(data.card);
    setAnswerInput("");
    setSubmittedAnswer("");
    setShowExplanation(false);
    setStage("QUESTION");
    startTimeRef.current = null;
    responseTimeMsRef.current = null;
    if (data.session) {
      setSession(data.session);
      setEnergy(data.session.energy);
    }
    setLoading(false);
  }, [topicId, router]);

  const startSession = useCallback(async () => {
    if (!topicId) return;
    sessionStartedAtRef.current = Date.now() / 1000;
    setSeenCardIds([]);
    sessionInteractionsRef.current = [];
    sessionRiBeforeRef.current = null;
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const start = await fetch("/api/session/start", { method: "POST", headers: authHeaders() });
    if (start.status === 401) {
      router.replace("/login");
      return;
    }
    if (start.ok) {
      const j = (await start.json().catch(() => ({}))) as {
        ri_before?: number;
        started_at_ts?: number;
      };
      if (typeof j.ri_before === "number") sessionRiBeforeRef.current = j.ri_before;
      if (typeof j.started_at_ts === "number") sessionStartedAtRef.current = j.started_at_ts;
    }
    try {
      const topics = await fetchTopics();
      setHasAnyDecks(topics.length > 0);
    } catch {}
    await loadNextCard([]);
  }, [topicId, loadNextCard, router]);

  const finishSession = useCallback(async () => {
    if (summaryLoaded) return;
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const interactions = sessionInteractionsRef.current;
    const body: Record<string, unknown> = {
      started_at_ts:
        sessionStartedAtRef.current ?? Date.now() / 1000,
      session_summary: {
        cards_done: sessionRef.current.cards_done,
        cards_total: sessionRef.current.cards_total,
      },
    };
    if (sessionRiBeforeRef.current != null) {
      body.ri_before_snapshot = sessionRiBeforeRef.current;
    }
    if (interactions.length > 0) {
      body.interactions = interactions.map((x) => ({
        is_correct: Boolean(x.is_correct),
        response_time_ms: Math.round(x.response_time_ms),
        topic_id: x.topic_id,
      }));
    }

    const res = await fetch("/api/session/finish", {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = (await res.json()) as SessionFinishSummary;
      setSummary(data);
      setEnergy(Math.max(0, Math.round(data.energy_left ?? energy)));
      window.dispatchEvent(new CustomEvent("edulab-dashboard-refresh"));
    }
    setSummaryLoaded(true);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#262626", "#737373", "#A3A3A3", "#E5E5E5"],
    });
  }, [summaryLoaded, energy]);

  useEffect(() => {
    if (!topicId) return;
    void startSession();
  }, [topicId]);

  useEffect(() => {
    if (stage === "FINISHED") void finishSession();
  }, [stage, finishSession]);

  const energyContext = useMemo(() => ({ energy, setEnergy }), [energy]);
  const accuracyDisplay = useMemo(
    () => (summary ? formatSessionAccuracyDisplay(summary) : null),
    [summary]
  );

  const handleCheck = useCallback(() => {
    if (!card || stage !== "QUESTION") return;
    const startedAt = startTimeRef.current;
    const responseMs = startedAt == null ? 0 : performance.now() - startedAt;
    const response_time_ms_value = Math.max(1, Math.round(responseMs));
    responseTimeMsRef.current = response_time_ms_value;
    startTimeRef.current = null;

    setStage("CHECKING");
    const ok =
      normalizeAnswer(answerInput) === normalizeAnswer(card.answer_text) &&
      answerInput.trim().length > 0;
    setSubmittedAnswer(answerInput);
    setIsCorrect(ok);
    if (!ok) setShakeNonce((v) => v + 1);
    window.setTimeout(() => setStage("COMPARISON"), 300);
  }, [card, stage, answerInput]);

  const handleConfidence = useCallback(
    async (confidence: Confidence) => {
      if (!card) return;
      const response_time_ms_value = Math.max(
        1,
        responseTimeMsRef.current ?? 1
      );

      // Optimistic header progress: update bar immediately after choosing Q.
      setSession((prev) =>
        prev ? { ...prev, cards_done: prev.cards_done + 1 } : prev
      );
      setSeenCardIds((prev) =>
        prev.includes(card.card_id) ? prev : [...prev, card.card_id]
      );

      const res = await fetch("/api/study/process-answer", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          card_id: card.card_id,
          confidence,
          response_thinking_time_ms: response_time_ms_value,
          is_correct: isCorrect,
          user_answer: submittedAnswer,
          current_session_energy: energy,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ProcessAnswerResponse;
      if (!res.ok) return;

      if (data.fast_track_week) {
        setFastTrackPinned(true);
      }

      const tid = Number(topicId) || 0;
      const record: SessionInteractionRecord = {
        is_correct: isCorrect,
        response_time_ms: Math.round(response_time_ms_value),
        topic_id: tid,
      };
      sessionInteractionsRef.current = [...sessionInteractionsRef.current, record];

      const nextEnergy = Math.max(0, Number(data.energy_left ?? energy));
      setEnergy(nextEnergy);
      setSession((prev) => (prev ? { ...prev, energy: nextEnergy } : prev));

      if (data.session_completed || nextEnergy < 10) {
        setShowBreakHint(Boolean(data.suggest_break));
        setStage("FINISHED");
        return;
      }

      if (data.suggest_break) setShowBreakHint(true);
      setStage("TRANSITION");
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      const nextSeen = Array.from(
        new Set([...seenCardIds, card.card_id])
      );
      await loadNextCard(nextSeen);
    },
    [card, isCorrect, submittedAnswer, energy, loadNextCard, seenCardIds]
  );

  useEffect(() => {
    if (stage !== "QUESTION" || !card) return;
    responseTimeMsRef.current = null;
    let cancelled = false;
    let innerRaf = 0;
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => {
        if (!cancelled) startTimeRef.current = performance.now();
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(outerRaf);
      window.cancelAnimationFrame(innerRaf);
    };
  }, [stage, card?.card_id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!card) return;
      if (stage === "QUESTION" && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleCheck();
      } else if (stage === "RATING" && e.key === "1") {
        e.preventDefault();
        void handleConfidence("тяжело");
      } else if (stage === "RATING" && e.key === "2") {
        e.preventDefault();
        void handleConfidence("средне");
      } else if (stage === "RATING" && e.key === "3") {
        e.preventDefault();
        void handleConfidence("легко");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [card, stage, handleCheck, handleConfidence]);

  return (
    <StudyEnergyContext.Provider value={energyContext}>
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950">
        {!loading && fastTrackPinned && (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-[60] flex max-w-[min(92vw,22rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
          >
            <span className="text-base" aria-hidden>
              ⚡
            </span>
            <span>Закреплено! Вернемся через неделю</span>
          </div>
        )}
        {!loading && <StudyExitButton onExit={() => router.push("/dashboard")} />}

        <main className="flex min-h-screen flex-col">
          <div className="pt-[calc(var(--app-header-h)+2.75rem)]">
            <div className="min-h-[calc(100vh-var(--app-header-h)-2.75rem)] px-6 py-8">
            {loading ? (
              <div className="mx-auto h-64 w-full max-w-2xl animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
            ) : (
              <>
            {showBreakHint && stage !== "FINISHED" && (
              <div className="mx-auto mb-4 w-full max-w-4xl rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                Энергия ниже оптимума, лучше сделать перерыв.
              </div>
            )}

            {stage === "FINISHED" && (
              <section className="mx-auto grid w-full max-w-4xl gap-6">
                <div className="rounded-xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
                  <h2 className="text-3xl">Сессия завершена. Отличная работа!</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <MetricCard
                    label="Эффективность"
                    value={`${(summary?.eta_percent ?? 0).toFixed(1)}%`}
                  />
                  <MetricCard
                    label="Изменение уровня знаний"
                    value={
                      summary?.delta_knowledge_level != null &&
                      Number.isFinite(summary.delta_knowledge_level)
                        ? `${summary.delta_knowledge_level >= 0 ? "+" : ""}${summary.delta_knowledge_level.toFixed(1)}`
                        : `${(summary?.delta_ri ?? 0) >= 0 ? "+" : ""}${Math.round((summary?.delta_ri ?? 0) / 10)}`
                    }
                  />
                  <MetricCard
                    label="Точность"
                    value={accuracyDisplay?.text ?? "—"}
                    valueClassName={
                      accuracyDisplay?.highlight
                        ? "text-emerald-700 dark:text-emerald-400"
                        : undefined
                    }
                  />
                  <MetricCard
                    label="Время раздумий"
                    value={formatThinkingMs(summary?.total_response_time_ms ?? 0)}
                  />
                </div>
                <p className="text-center text-xs text-neutral-500">
                  Длительность сессии (стена):{" "}
                  {formatStudyTimeHours((summary?.session_minutes ?? 0) / 60)}
                </p>
                <div className="rounded-xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="text-xs uppercase text-neutral-500">Уровень знаний</div>
                  <SummaryCounter
                    fromRi={summary?.ri_before ?? 0}
                    toRi={summary?.ri_after ?? 0}
                    knowledgeBefore={summary?.knowledge_level_before}
                    knowledgeAfter={summary?.knowledge_level_after}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="rounded-md bg-[#2F3437] px-4 py-2 text-sm font-medium text-white"
                  >
                    Вернуться в Dashboard
                  </button>
                  {(summary?.energy_left ?? energy) > 30 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSummary(null);
                        setSummaryLoaded(false);
                        sessionInteractionsRef.current = [];
                        setStage("QUESTION");
                        void startSession();
                      }}
                      className="rounded-md border border-[#E4E4E7] px-4 py-2 text-sm"
                    >
                      Повторить еще раз
                    </button>
                  )}
                </div>
              </section>
            )}

            {stage === "EMPTY" && (
              <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
                <div className="w-full max-w-xl rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-8 py-10 text-center dark:border-[#27272A] dark:bg-[#18181B]">
                  <h2 className="text-xl text-neutral-900 dark:text-neutral-100">
                    {hasAnyDecks
                      ? "В этой колоде пока нет карточек для повторения"
                      : "Пока нет колод и карточек для повторения"}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500">
                    {hasAnyDecks
                      ? "Добавьте карточки в колоду или начните повторение позже — оно появится по расписанию."
                      : "Создайте первую колоду и добавьте карточки, чтобы начать обучение."}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => void loadNextCard()}
                      className="rounded-md border border-[#E4E4E7] px-4 py-2 text-sm text-neutral-700 hover:bg-white dark:border-[#27272A] dark:text-neutral-200 dark:hover:bg-[#09090B]"
                    >
                      Обновить
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/topics")}
                      className="rounded-md bg-[#2F3437] px-4 py-2 text-sm font-medium text-white"
                    >
                      Управлять колодами
                    </button>
                  </div>
                </div>
              </div>
            )}

            {card && stage !== "FINISHED" && stage !== "EMPTY" && (
              <div className="flex min-h-[calc(100vh-var(--app-header-h)-2.75rem)] flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.section
                    key={`${card.card_id}-${shakeNonce}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{
                      opacity: stage === "TRANSITION" ? 0 : 1,
                      y: stage === "TRANSITION" ? -60 : 0,
                      x:
                        stage === "COMPARISON" && !isCorrect
                          ? [0, -8, 8, -6, 6, 0]
                          : 0,
                    }}
                    exit={{ opacity: 0, y: -60 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-2xl rounded-[12px] border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="mb-4 text-xs capitalize text-neutral-500">{card.card_type}</div>
                    <div className="mb-6 max-h-[320px] min-w-0 overflow-y-auto overflow-x-auto">
                      {renderLatexBlock(card.question_text)}
                    </div>

                    {stage === "QUESTION" && (
                      <div className="space-y-3">
                        <textarea
                          autoFocus
                          value={answerInput}
                          onChange={(e) => setAnswerInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleCheck();
                            }
                          }}
                          placeholder="Введите ответ или формулу..."
                          className="min-h-[120px] w-full resize-y border-0 border-b border-[#E4E4E7] bg-transparent px-0 py-4 text-base outline-none focus:border-[#2F3437] dark:border-[#27272A] dark:focus:border-[#4F46E5]"
                        />
                        <button type="button" onClick={handleCheck} className="rounded-md bg-[#2F3437] px-4 py-2 text-sm font-medium text-white">
                          Проверить (Enter)
                        </button>
                      </div>
                    )}

                    {stage === "CHECKING" && <div className="text-sm text-neutral-500">Проверяем ответ...</div>}

                    {(stage === "COMPARISON" || stage === "TRANSITION") && (
                      <div className="space-y-4">
                        <div className={`rounded-md border px-3 py-2 text-sm ${isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                          {isCorrect ? "Верно" : "Неверно"}
                        </div>
                        {isCorrect ? (
                          !answerAlreadyInQuestionBody(card) ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                              <div className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">Правильный ответ</div>
                              <div className="min-w-0 overflow-x-auto font-semibold text-emerald-900 dark:text-emerald-100">
                                {renderLatexBlock(card.answer_text)}
                              </div>
                            </div>
                          ) : null
                        ) : (
                          <div
                            className={
                              answerAlreadyInQuestionBody(card)
                                ? "space-y-3"
                                : "grid gap-3 md:grid-cols-2"
                            }
                          >
                            <div className="rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 dark:border-[#27272A] dark:bg-[#09090B]">
                              <div className="mb-1 text-xs text-neutral-500">Твой ответ</div>
                              {renderAnswerMaybeLatex(
                                submittedAnswer,
                                "text-sm text-neutral-500 line-through"
                              )}
                            </div>
                            {!answerAlreadyInQuestionBody(card) && (
                              <div className="rounded-lg border border-[#E4E4E7] bg-[#F7F7F7] px-3 py-2 font-semibold text-neutral-900 shadow-[0_0_15px_rgba(34,197,94,0.1)] dark:border-[#27272A] dark:bg-[#121214] dark:text-neutral-100">
                                <div className="mb-1 text-xs font-normal text-neutral-500">Ожидаемый ответ</div>
                                <div className="min-w-0 overflow-x-auto font-semibold">
                                  {renderLatexBlock(card.answer_text)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <div>
                          <button type="button" onClick={() => setShowExplanation((v) => !v)} className="text-sm text-neutral-600 underline underline-offset-2 dark:text-neutral-300">
                            {showExplanation ? "Скрыть объяснение" : "Показать объяснение"}
                          </button>
                          {showExplanation && (
                            <div className="mt-3 rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-sm dark:border-[#27272A] dark:bg-[#09090B]">
                              {card.explanation_text?.trim() || "Подробное объяснение будет добавлено позже."}
                            </div>
                          )}
                        </div>
                        {stage !== "TRANSITION" && (
                          <button
                            type="button"
                            onClick={() => setStage("RATING")}
                            className="rounded-md bg-[#2F3437] px-4 py-2 text-sm font-medium text-white"
                          >
                            Продолжить
                          </button>
                        )}
                      </div>
                    )}

                    {stage === "RATING" && (
                      <div className="space-y-2">
                        <p className="text-xs text-neutral-500">Оцените уверенность (клавиши 1/2/3)</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <button type="button" onClick={() => void handleConfidence("тяжело")} className="rounded-md border border-[#E4E4E7] px-3 py-2 text-sm">Тяжело (Q=3)</button>
                          <button type="button" onClick={() => void handleConfidence("средне")} className="rounded-md border border-[#E4E4E7] px-3 py-2 text-sm">Средне (Q=4)</button>
                          <button type="button" onClick={() => void handleConfidence("легко")} className="rounded-md border border-[#E4E4E7] px-3 py-2 text-sm">Легко (Q=5)</button>
                        </div>
                      </div>
                    )}
                  </motion.section>
                </AnimatePresence>
              </div>
            )}
              </>
            )}
            </div>
          </div>
        </main>
      </div>
    </StudyEnergyContext.Provider>
  );
}

