"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchCardsInTopic, type TopicCardListItem } from "@/lib/api/content";
import { sameCardText } from "@/lib/card-text";
import {
  postMatchingBatch,
  saveMatchingPending,
} from "@/lib/matching-batch-sync";
import {
  getShuffledSubset,
  type PairCountOption,
} from "@/lib/matching-subset";

const COLOR_LOCKED_LINE = "rgba(16, 185, 129, 0.5)";
const COLOR_ERROR = "#ef4444";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parsePairOption(
  pairsParam: string | null | undefined
): PairCountOption {
  if (pairsParam === "5") return 5;
  if (pairsParam === "10") return 10;
  if (pairsParam === "15") return 15;
  if (pairsParam === "all") return "all";
  return 10;
}

function asPlainPreview(s: string, max = 90): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

type LineSeg = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
};

function lineSegsFingerprint(segs: LineSeg[]): string {
  return segs
    .map(
      (s) =>
        `${s.key}:${s.x1.toFixed(2)},${s.y1.toFixed(2)}-${s.x2.toFixed(2)},${s.y2.toFixed(2)}:${s.stroke}:${s.strokeWidth}`
    )
    .join("|");
}

function useMatchingLineGeometry(
  boardRef: RefObject<HTMLDivElement | null>,
  qRefs: React.MutableRefObject<Map<number, HTMLButtonElement>>,
  aRefs: React.MutableRefObject<Map<number, HTMLButtonElement>>,
  matchedIds: Set<number>,
  errorPair: { qId: number; aId: number } | null
) {
  const [segments, setSegments] = useState<LineSeg[]>([]);
  const matchedIdsRef = useRef(matchedIds);
  const errorPairRef = useRef(errorPair);
  matchedIdsRef.current = matchedIds;
  errorPairRef.current = errorPair;

  const recompute = useCallback(() => {
    const board = boardRef.current;
    const ids = matchedIdsRef.current;
    const err = errorPairRef.current;
    if (!board) {
      setSegments((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const br = board.getBoundingClientRect();
    const next: LineSeg[] = [];

    const center = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - br.left,
        y: r.top + r.height / 2 - br.top,
      };
    };

    for (const id of ids) {
      const qEl = qRefs.current.get(id);
      const aEl = aRefs.current.get(id);
      if (!qEl || !aEl) continue;
      const p1 = center(qEl);
      const p2 = center(aEl);
      next.push({
        key: `ok-${id}`,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        stroke: COLOR_LOCKED_LINE,
        strokeWidth: 1.5,
        opacity: 1,
      });
    }

    if (err) {
      const qEl = qRefs.current.get(err.qId);
      const aEl = aRefs.current.get(err.aId);
      if (qEl && aEl) {
        const p1 = center(qEl);
        const p2 = center(aEl);
        next.push({
          key: "err",
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          stroke: COLOR_ERROR,
          strokeWidth: 3,
          opacity: 1,
        });
      }
    }

    const fp = lineSegsFingerprint(next);
    setSegments((prev) =>
      fp === lineSegsFingerprint(prev) ? prev : next
    );
  }, [boardRef, qRefs, aRefs]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute, matchedIds, errorPair]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let roFrame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(roFrame);
      roFrame = requestAnimationFrame(() => recompute());
    });
    ro.observe(board);
    const onScrollOrResize = () => recompute();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      cancelAnimationFrame(roFrame);
      ro.disconnect();
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [boardRef, recompute]);

  return { segments, recompute };
}

const SHAKE_X = [0, -8, 8, -8, 8, -5, 5, 0];

const PAIR_OPTIONS: PairCountOption[] = [5, 10, 15, "all"];

export function MatchingMode({
  topicId,
  pairsParam,
  timerParam,
  onExit,
}: {
  topicId: number;
  pairsParam?: string | null;
  timerParam?: string | null;
  onExit: () => void;
}) {
  const router = useRouter();
  const timerEnabled = timerParam === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deckPool, setDeckPool] = useState<TopicCardListItem[]>([]);
  const [sessionPhase, setSessionPhase] = useState<
    "setup" | "play" | "complete"
  >("setup");
  const [cards, setCards] = useState<TopicCardListItem[]>([]);
  const [pairPreset, setPairPreset] = useState<PairCountOption>(() =>
    parsePairOption(pairsParam)
  );
  const [matchedIds, setMatchedIds] = useState<Set<number>>(new Set());
  const [pickedQ, setPickedQ] = useState<number | null>(null);
  const [pickedA, setPickedA] = useState<number | null>(null);
  const [errorPair, setErrorPair] = useState<{
    qId: number;
    aId: number;
  } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [roundSync, setRoundSync] = useState<
    "idle" | "admiring" | "submitting" | "synced" | "offline"
  >("idle");

  const pairOptionRef = useRef<PairCountOption>(10);
  const matchSessionIdRef = useRef<string | null>(null);
  const wrongAttemptsRef = useRef(0);
  const secondsRef = useRef(0);
  wrongAttemptsRef.current = wrongAttempts;
  secondsRef.current = seconds;
  const wrongTouchByCardRef = useRef<Record<number, number>>({});
  const matchingBatchResultsRef = useRef<
    { card_id: number; q_value: number; mode: "matching" }[]
  >([]);
  const chainStartedRef = useRef(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const qRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const aRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const { segments, recompute } = useMatchingLineGeometry(
    boardRef,
    qRefs,
    aRefs,
    matchedIds,
    errorPair
  );

  useEffect(() => {
    setPairPreset(parsePairOption(pairsParam));
  }, [pairsParam]);

  useEffect(() => {
    if (!timerEnabled) return;
    if (sessionPhase !== "play") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerEnabled, sessionPhase]);

  const fetchDeck = useCallback(async () => {
    if (!Number.isFinite(topicId) || topicId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const all = await fetchCardsInTopic(topicId, 400);
      const filtered = all.filter(
        (c) =>
          c.question_text.trim().length > 0 &&
          c.answer_text.trim().length > 0 &&
          !sameCardText(c.question_text, c.answer_text)
      );
      setDeckPool(filtered);
      setSessionPhase("setup");
      setCards([]);
      setMatchedIds(new Set());
      setPickedQ(null);
      setPickedA(null);
      setErrorPair(null);
      setSeconds(0);
      setWrongAttempts(0);
      setRoundSync("idle");
      wrongTouchByCardRef.current = {};
      matchingBatchResultsRef.current = [];
      chainStartedRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить карточки");
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    void fetchDeck();
  }, [fetchDeck]);

  const beginRound = useCallback(
    (choice: PairCountOption) => {
      if (deckPool.length < 3) return;
      pairOptionRef.current = choice;
      matchSessionIdRef.current = crypto.randomUUID();
      setCards(getShuffledSubset(deckPool, choice));
      setSessionPhase("play");
      setMatchedIds(new Set());
      setPickedQ(null);
      setPickedA(null);
      setErrorPair(null);
      setSeconds(0);
      setWrongAttempts(0);
      wrongTouchByCardRef.current = {};
      matchingBatchResultsRef.current = [];
      chainStartedRef.current = false;
      setRoundSync("idle");
    },
    [deckPool]
  );

  const reshuffleRound = useCallback(() => {
    if (sessionPhase !== "play" || deckPool.length === 0) return;
    setCards(getShuffledSubset(deckPool, pairOptionRef.current));
    setMatchedIds(new Set());
    setPickedQ(null);
    setPickedA(null);
    setErrorPair(null);
    setSeconds(0);
    setWrongAttempts(0);
    matchSessionIdRef.current = crypto.randomUUID();
    wrongTouchByCardRef.current = {};
    matchingBatchResultsRef.current = [];
    chainStartedRef.current = false;
    setRoundSync("idle");
  }, [sessionPhase, deckPool]);

  const questions = useMemo(
    () => shuffle(cards.map((c) => ({ id: c.card_id, text: c.question_text }))),
    [cards]
  );
  const answers = useMemo(
    () => shuffle(cards.map((c) => ({ id: c.card_id, text: c.answer_text }))),
    [cards]
  );

  useLayoutEffect(() => {
    window.requestAnimationFrame(() => recompute());
  }, [questions, answers, recompute]);

  useEffect(() => {
    if (!errorPair) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      recompute();
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [errorPair, recompute]);

  useEffect(() => {
    if (pickedQ == null || pickedA == null) return;

    if (pickedQ === pickedA) {
      const cid = pickedQ;
      const errN = wrongTouchByCardRef.current[cid] ?? 0;
      const qv = errN === 0 ? 5 : errN === 1 ? 3 : 1;
      matchingBatchResultsRef.current.push({
        card_id: cid,
        q_value: qv,
        mode: "matching",
      });
      setMatchedIds((prev) => new Set(prev).add(pickedQ));
      setPickedQ(null);
      setPickedA(null);
      setErrorPair(null);
      window.requestAnimationFrame(() => recompute());
      return;
    }

    wrongTouchByCardRef.current[pickedQ] =
      (wrongTouchByCardRef.current[pickedQ] ?? 0) + 1;
    wrongTouchByCardRef.current[pickedA] =
      (wrongTouchByCardRef.current[pickedA] ?? 0) + 1;
    setWrongAttempts((w) => w + 1);
    setErrorPair({ qId: pickedQ, aId: pickedA });
    const t = window.setTimeout(() => {
      setPickedQ(null);
      setPickedA(null);
      setErrorPair(null);
      window.requestAnimationFrame(() => recompute());
    }, 500);
    return () => window.clearTimeout(t);
  }, [pickedQ, pickedA, recompute]);

  useEffect(() => {
    if (sessionPhase !== "play" || cards.length === 0) return;
    if (matchedIds.size !== cards.length) return;
    if (chainStartedRef.current) return;
    chainStartedRef.current = true;
    setRoundSync("admiring");

    const admireMs = 1000;
    const t = window.setTimeout(() => {
      setRoundSync("submitting");
      void (async () => {
        const results = matchingBatchResultsRef.current;
        const sid = matchSessionIdRef.current ?? "";
        const totalMs = Math.max(
          1000,
          Math.round(secondsRef.current * 1000)
        );
        const body = {
          topic_id: topicId,
          session_id: sid,
          results,
          total_response_time_ms: totalMs,
        };
        try {
          const res = await postMatchingBatch(body);
          if (!res.ok) throw new Error(`batch ${res.status}`);
          confetti({
            particleCount: 110,
            spread: 70,
            origin: { y: 0.55 },
            colors: ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1d5db"],
          });
          setRoundSync("synced");
          setSessionPhase("complete");
          window.dispatchEvent(new CustomEvent("edulab-dashboard-refresh"));
        } catch {
          saveMatchingPending(body);
          setRoundSync("offline");
          setSessionPhase("complete");
        }
      })();
    }, admireMs);
    return () => window.clearTimeout(t);
  }, [sessionPhase, cards.length, matchedIds.size, topicId]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const cardN = deckPool.length;
  const tooSmall = !loading && cardN < 3;

  const setQRef = (id: number, el: HTMLButtonElement | null) => {
    if (el) qRefs.current.set(id, el);
    else qRefs.current.delete(id);
  };
  const setARef = (id: number, el: HTMLButtonElement | null) => {
    if (el) aRefs.current.set(id, el);
    else aRefs.current.delete(id);
  };

  const tileClass = (
    side: "q" | "a",
    id: number,
    matched: boolean,
    selected: boolean
  ) => {
    const inError =
      errorPair &&
      ((side === "q" && errorPair.qId === id) ||
        (side === "a" && errorPair.aId === id));
    if (matched) {
      return "is-locked rounded-lg border border-[#10b981]/60 bg-emerald-50/95 px-3 py-2 text-left text-[12px] text-emerald-950 transition-colors dark:bg-emerald-950/30 dark:text-emerald-100";
    }
    if (inError) {
      return "rounded-lg border-2 border-[#ef4444] bg-red-50/90 px-3 py-2 text-left text-[12px] text-red-950 dark:bg-red-950/30 dark:text-red-100";
    }
    if (selected) {
      return "rounded-lg border-2 border-neutral-900 bg-neutral-900 px-3 py-2 text-left text-[12px] text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900";
    }
    return "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-[12px] text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
  };

  const maxPairsLabel =
    pairPreset === "all" ? Math.min(deckPool.length, 400) : pairPreset;

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-[12px] text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            ← Назад
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
              Режим: Сопоставление
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500">
              {sessionPhase === "setup" ? (
                <>Выберите число пар · в колоде {deckPool.length} подходящих</>
              ) : sessionPhase === "complete" ? (
                <>
                  {roundSync === "offline"
                    ? "Результат сохранён локально — отправим при следующем заходе"
                    : "Прогресс на сервере обновлён"}
                </>
              ) : (
                <>
                  {timerEnabled ? `Время: ${mm}:${ss}` : "Без таймера"} · пар:{" "}
                  {cards.length}
                  {roundSync === "submitting" ? " · Сохраняем прогресс…" : ""}
                  {roundSync === "admiring" ? " · Смотрите граф связей…" : ""}
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={
              sessionPhase === "complete" || roundSync === "submitting"
            }
            onClick={() =>
              sessionPhase === "play" ? reshuffleRound() : void fetchDeck()
            }
            className="rounded-md bg-[#2F3437] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {sessionPhase === "play" ? "Перемешать" : "Обновить колоду"}
          </button>
        </div>

        {loading ? (
          <div className="h-56 animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : tooSmall ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-[13px] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
            В колоде мало карточек для сопоставления. Добавьте ещё хотя бы 2
            карточки.
          </div>
        ) : sessionPhase === "setup" ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
              Сколько пар сопоставим?
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500">
              Сначала берутся карточки с наименьшим освоением, затем порядок
              перемешивается.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PAIR_OPTIONS.map((opt) => {
                const label = opt === "all" ? "Все" : String(opt);
                const disabled =
                  opt !== "all" && typeof opt === "number" && deckPool.length < opt;
                const active = pairPreset === opt;
                return (
                  <button
                    key={String(opt)}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPairPreset(opt)}
                    className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
                      active
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                        : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={deckPool.length < 3}
              onClick={() => beginRound(pairPreset)}
              className="mt-6 rounded-md bg-[#2F3437] px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Начать ({pairPreset === "all" ? "все" : pairPreset} пар · до{" "}
              {maxPairsLabel})
            </button>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {sessionPhase === "play" &&
              matchedIds.size === cards.length &&
              cards.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 text-[12px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
                >
                  {roundSync === "submitting"
                    ? "Отправляем результаты на сервер…"
                    : "Готово! Все пары на месте — граф связей зафиксирован."}
                  {timerEnabled ? ` · ${mm}:${ss}` : ""}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {sessionPhase === "complete" ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/95 p-5 dark:border-emerald-800 dark:bg-emerald-950/35">
                <h3 className="text-[15px] font-medium text-emerald-950 dark:text-emerald-100">
                  Раунд завершён
                </h3>
                {roundSync === "offline" ? (
                  <p className="mt-2 text-[12px] text-emerald-900/90 dark:text-emerald-200/90">
                    Нет сети: результат сохранён в этом браузере. На дашборде
                    при следующем заходе мы отправим его автоматически.
                  </p>
                ) : (
                  <p className="mt-2 text-[12px] text-emerald-900/90 dark:text-emerald-200/90">
                    Карточки и тема обновлены с учётом режима сопоставления
                    (коэффициент освоения 0.7).
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => router.push("/dashboard?refresh=1")}
                  className="mt-4 rounded-md bg-[#2F3437] px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                >
                  Посмотреть итоги
                </button>
              </div>
            ) : null}

            <div
              ref={boardRef}
              className="relative min-h-[280px] rounded-xl border border-neutral-200/80 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80"
            >
              <svg
                className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
                aria-hidden
              >
                {segments.map((s) => (
                  <line
                    key={s.key}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    stroke={s.stroke}
                    strokeWidth={s.strokeWidth}
                    strokeOpacity={s.opacity}
                    strokeLinecap="round"
                  />
                ))}
              </svg>

              <div className="relative z-10 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-transparent bg-white/95 p-3 dark:bg-neutral-900/95">
                  <div className="mb-3 text-[11px] font-medium text-neutral-500">
                    Вопросы
                  </div>
                  <div className="grid gap-2">
                    {questions.map((q) => {
                      const matched = matchedIds.has(q.id);
                      const selected = pickedQ === q.id;
                      const shaking = Boolean(errorPair && errorPair.qId === q.id);
                      return (
                        <motion.button
                          key={q.id}
                          type="button"
                          ref={(el) => setQRef(q.id, el)}
                          disabled={matched}
                          onClick={() => {
                            if (matched) return;
                            setPickedQ((prev) => (prev === q.id ? null : q.id));
                          }}
                          animate={shaking ? { x: SHAKE_X } : { x: 0 }}
                          transition={{ duration: 0.48, ease: "easeInOut" }}
                          className={tileClass("q", q.id, matched, selected)}
                        >
                          {asPlainPreview(q.text)}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-transparent bg-white/95 p-3 dark:bg-neutral-900/95">
                  <div className="mb-3 text-[11px] font-medium text-neutral-500">
                    Ответы
                  </div>
                  <div className="grid gap-2">
                    {answers.map((a) => {
                      const matched = matchedIds.has(a.id);
                      const selected = pickedA === a.id;
                      const shaking = Boolean(errorPair && errorPair.aId === a.id);
                      return (
                        <motion.button
                          key={a.id}
                          type="button"
                          ref={(el) => setARef(a.id, el)}
                          disabled={matched}
                          onClick={() => {
                            if (matched) return;
                            setPickedA((prev) => (prev === a.id ? null : a.id));
                          }}
                          animate={shaking ? { x: SHAKE_X } : { x: 0 }}
                          transition={{ duration: 0.48, ease: "easeInOut" }}
                          className={tileClass("a", a.id, matched, selected)}
                        >
                          {asPlainPreview(a.text)}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
