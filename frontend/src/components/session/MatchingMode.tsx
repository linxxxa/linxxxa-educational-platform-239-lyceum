"use client";

import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchCardsInTopic, type TopicCardListItem } from "@/lib/api/content";
import { sameCardText } from "@/lib/card-text";
import { matchingQualityFromWrongTouches } from "@/lib/matching-q";
import {
  postMatchingBatch,
  saveMatchingPending,
} from "@/lib/matching-batch-sync";
import {
  getShuffledSubset,
  type PairCountOption,
} from "@/lib/matching-subset";

const COLOR_OK = "rgba(16, 185, 129, 0.5)";
const COLOR_ERR = "#ef4444";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parsePairOption(p: string | null | undefined): PairCountOption {
  if (p === "5") return 5;
  if (p === "10") return 10;
  if (p === "15") return 15;
  if (p === "all") return "all";
  return 10;
}

function preview(s: string, max = 90): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

type SyncState = "idle" | "admiring" | "submitting" | "synced" | "offline";

type BatchSummary = {
  delta_knowledge_level: number;
  learning_efficiency_pct: number | null;
  topic_knowledge_after: number;
};

type GameState = {
  phase: "setup" | "play" | "complete";
  pairPreset: PairCountOption;
  cards: TopicCardListItem[];
  matched: number[];
  pickQ: number | null;
  pickA: number | null;
  err: { q: number; a: number } | null;
  seconds: number;
  sync: SyncState;
  summary: BatchSummary | null;
  wrongTouch: Record<number, number>;
};

function emptyGame(preset: PairCountOption): GameState {
  return {
    phase: "setup",
    pairPreset: preset,
    cards: [],
    matched: [],
    pickQ: null,
    pickA: null,
    err: null,
    seconds: 0,
    sync: "idle",
    summary: null,
    wrongTouch: {},
  };
}

type LineSeg = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  sw: number;
};

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
  const timerOn = timerParam === "1";

  const [meta, setMeta] = useState<{
    loading: boolean;
    error: string | null;
    deck: TopicCardListItem[];
  }>({ loading: true, error: null, deck: [] });

  const [game, setGame] = useState<GameState>(() =>
    emptyGame(parsePairOption(pairsParam))
  );

  const boardRef = useRef<HTMLDivElement>(null);
  const qRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const aRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const batchRef = useRef<{ card_id: number; q_value: number; mode: "matching" }[]>(
    []
  );
  /** Инкремент при новом раунде / загрузке колоды — отменяет «висящие» таймеры admire/submit. */
  const admireGen = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const pairOptRef = useRef<PairCountOption>(10);
  const secondsSnap = useRef(0);

  const [lines, setLines] = useState<LineSeg[]>([]);

  useEffect(() => {
    setGame((g) => ({ ...g, pairPreset: parsePairOption(pairsParam) }));
  }, [pairsParam]);

  const fetchDeck = useCallback(async () => {
    if (!Number.isFinite(topicId) || topicId <= 0) return;
    setMeta((m) => ({ ...m, loading: true, error: null }));
    try {
      const all = await fetchCardsInTopic(topicId, 400);
      const deck = all.filter(
        (c) =>
          c.question_text.trim().length > 0 &&
          c.answer_text.trim().length > 0 &&
          !sameCardText(c.question_text, c.answer_text)
      );
      setMeta({ loading: false, error: null, deck });
      admireGen.current += 1;
      batchRef.current = [];
      sessionIdRef.current = null;
      setGame((g) => ({
        ...emptyGame(g.pairPreset),
        pairPreset: g.pairPreset,
      }));
      setLines([]);
    } catch (e) {
      setMeta({
        loading: false,
        error: e instanceof Error ? e.message : "Ошибка загрузки",
        deck: [],
      });
    }
  }, [topicId]);

  useEffect(() => {
    void fetchDeck();
  }, [fetchDeck]);

  useEffect(() => {
    if (!timerOn || game.phase !== "play") return;
    const id = window.setInterval(
      () =>
        setGame((g) =>
          g.phase === "play" ? { ...g, seconds: g.seconds + 1 } : g
        ),
      1000
    );
    return () => window.clearInterval(id);
  }, [timerOn, game.phase]);

  secondsSnap.current = game.seconds;

  const questions = useMemo(
    () => shuffle(game.cards.map((c) => ({ id: c.card_id, text: c.question_text }))),
    [game.cards]
  );
  const answers = useMemo(
    () => shuffle(game.cards.map((c) => ({ id: c.card_id, text: c.answer_text }))),
    [game.cards]
  );

  const paintLines = useCallback(() => {
    const board = boardRef.current;
    if (!board || game.phase === "setup") {
      setLines([]);
      return;
    }
    const br = board.getBoundingClientRect();
    const ctr = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - br.left,
        y: r.top + r.height / 2 - br.top,
      };
    };
    const next: LineSeg[] = [];
    for (const id of game.matched) {
      const qEl = qRefs.current.get(id);
      const aEl = aRefs.current.get(id);
      if (!qEl || !aEl) continue;
      const p1 = ctr(qEl);
      const p2 = ctr(aEl);
      next.push({
        key: `ok-${id}`,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        stroke: COLOR_OK,
        sw: 1.5,
      });
    }
    if (game.err) {
      const qEl = qRefs.current.get(game.err.q);
      const aEl = aRefs.current.get(game.err.a);
      if (qEl && aEl) {
        const p1 = ctr(qEl);
        const p2 = ctr(aEl);
        next.push({
          key: "err",
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          stroke: COLOR_ERR,
          sw: 3,
        });
      }
    }
    setLines(next);
  }, [game.matched, game.err, game.phase]);

  useEffect(() => {
    paintLines();
    window.addEventListener("resize", paintLines);
    return () => window.removeEventListener("resize", paintLines);
  }, [paintLines, questions.length, answers.length]);

  useEffect(() => {
    const q = game.pickQ;
    const a = game.pickA;
    if (q == null || a == null) return;

    if (q === a) {
      setGame((g) => {
        const touches = g.wrongTouch[q] ?? 0;
        const qv = matchingQualityFromWrongTouches(touches);
        batchRef.current.push({ card_id: q, q_value: qv, mode: "matching" });
        const matched = g.matched.includes(q) ? g.matched : [...g.matched, q];
        return {
          ...g,
          matched,
          pickQ: null,
          pickA: null,
          err: null,
        };
      });
      return;
    }

    setGame((g) => ({
      ...g,
      wrongTouch: {
        ...g.wrongTouch,
        [q]: (g.wrongTouch[q] ?? 0) + 1,
        [a]: (g.wrongTouch[a] ?? 0) + 1,
      },
      err: { q, a },
    }));

    const t = window.setTimeout(() => {
      setGame((g) => ({ ...g, pickQ: null, pickA: null, err: null }));
    }, 500);
    return () => window.clearTimeout(t);
  }, [game.pickQ, game.pickA]);

  useEffect(() => {
    if (game.phase !== "play" || game.cards.length === 0) return;
    if (game.matched.length !== game.cards.length) return;
    setGame((g) => ({ ...g, sync: "admiring" }));
    const myGen = admireGen.current;

    const t = window.setTimeout(() => {
      if (myGen !== admireGen.current) return;
      setGame((g) => ({ ...g, sync: "submitting" }));
      void (async () => {
        if (myGen !== admireGen.current) return;
        const body = {
          topic_id: topicId,
          session_id: sessionIdRef.current ?? "",
          results: batchRef.current,
          total_response_time_ms: Math.max(1000, secondsSnap.current * 1000),
        };
        try {
          const res = await postMatchingBatch(body);
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as {
            delta_knowledge_level?: number;
            learning_efficiency_pct?: number | null;
            topic_knowledge_after?: number;
          };
          confetti({
            particleCount: 100,
            spread: 68,
            origin: { y: 0.55 },
            colors: ["#10b981", "#34d399", "#a7f3d0", "#d1d5db"],
          });
          setGame((g) => ({
            ...g,
            phase: "complete",
            sync: "synced",
            summary: {
              delta_knowledge_level: Number(data.delta_knowledge_level ?? 0),
              learning_efficiency_pct:
                data.learning_efficiency_pct != null &&
                Number.isFinite(Number(data.learning_efficiency_pct))
                  ? Number(data.learning_efficiency_pct)
                  : null,
              topic_knowledge_after: Number(data.topic_knowledge_after ?? 0),
            },
          }));
          window.dispatchEvent(new CustomEvent("edulab-dashboard-refresh"));
        } catch {
          saveMatchingPending(body);
          setGame((g) => ({
            ...g,
            phase: "complete",
            sync: "offline",
            summary: null,
          }));
        }
      })();
    }, 1000);
    return () => window.clearTimeout(t);
  }, [game.phase, game.cards.length, game.matched.length, topicId]);

  const beginRound = (choice: PairCountOption) => {
    if (meta.deck.length < 3) return;
    pairOptRef.current = choice;
    sessionIdRef.current = crypto.randomUUID();
    admireGen.current += 1;
    batchRef.current = [];
    setGame((g) => ({
      phase: "play",
      pairPreset: choice,
      cards: getShuffledSubset(meta.deck, choice),
      matched: [],
      pickQ: null,
      pickA: null,
      err: null,
      seconds: 0,
      sync: "idle",
      summary: null,
      wrongTouch: {},
    }));
  };

  const reshuffleRound = () => {
    if (game.phase !== "play" || meta.deck.length === 0) return;
    sessionIdRef.current = crypto.randomUUID();
    admireGen.current += 1;
    batchRef.current = [];
    setGame((g) => ({
      ...g,
      cards: getShuffledSubset(meta.deck, pairOptRef.current),
      matched: [],
      pickQ: null,
      pickA: null,
      err: null,
      seconds: 0,
      sync: "idle",
      summary: null,
      wrongTouch: {},
    }));
  };

  const setQRef = (id: number, el: HTMLButtonElement | null) => {
    if (el) qRefs.current.set(id, el);
    else qRefs.current.delete(id);
  };
  const setARef = (id: number, el: HTMLButtonElement | null) => {
    if (el) aRefs.current.set(id, el);
    else aRefs.current.delete(id);
  };

  const mm = String(Math.floor(game.seconds / 60)).padStart(2, "0");
  const ss = String(game.seconds % 60).padStart(2, "0");
  const tooSmall = !meta.loading && meta.deck.length < 3;
  const maxLabel =
    game.pairPreset === "all" ? Math.min(meta.deck.length, 400) : game.pairPreset;

  const locked =
    game.phase === "complete" ||
    game.sync === "admiring" ||
    game.sync === "submitting" ||
    (game.phase === "play" &&
      game.matched.length === game.cards.length &&
      game.cards.length > 0);

  const tileCls = (
    side: "q" | "a",
    id: number,
    matched: boolean,
    selected: boolean
  ) => {
    const hit =
      game.err &&
      ((side === "q" && game.err.q === id) || (side === "a" && game.err.a === id));
    const shake = Boolean(hit);
    const base =
      matched
        ? "is-locked rounded-lg border border-[#10b981]/60 bg-emerald-50/95 px-3 py-2 text-left text-[12px] text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
        : hit
          ? "rounded-lg border-2 border-[#ef4444] bg-red-50/90 px-3 py-2 text-left text-[12px] text-red-950 dark:bg-red-950/30 dark:text-red-100"
          : selected
            ? "rounded-lg border-2 border-neutral-900 bg-neutral-900 px-3 py-2 text-left text-[12px] text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
            : "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-[12px] text-neutral-800 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
    return `${base}${shake ? " match-tile--shake" : ""}`;
  };

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
              {game.phase === "setup" ? (
                <>Выберите число пар · в колоде {meta.deck.length} подходящих</>
              ) : game.phase === "complete" ? (
                <>
                  {game.sync === "offline"
                    ? "Результат сохранён локально"
                    : "Прогресс на сервере обновлён"}
                </>
              ) : (
                <>
                  {timerOn ? `Время: ${mm}:${ss}` : "Без таймера"} · пар:{" "}
                  {game.cards.length}
                  {game.sync === "submitting" ? " · Сохраняем…" : ""}
                  {game.sync === "admiring" ? " · Граф готов" : ""}
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={game.phase === "complete" || game.sync === "submitting"}
            onClick={() =>
              game.phase === "play" ? reshuffleRound() : void fetchDeck()
            }
            className="rounded-md bg-[#2F3437] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {game.phase === "play" ? "Перемешать" : "Обновить колоду"}
          </button>
        </div>

        {meta.loading ? (
          <div className="h-56 animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
        ) : meta.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {meta.error}
          </div>
        ) : tooSmall ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-[13px] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
            В колоде мало карточек для сопоставления.
          </div>
        ) : game.phase === "setup" ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
              Сколько пар сопоставим?
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500">
              Сначала слабее по освоению, затем порядок перемешивается.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PAIR_OPTIONS.map((opt) => {
                const label = opt === "all" ? "Все" : String(opt);
                const disabled =
                  opt !== "all" && typeof opt === "number" && meta.deck.length < opt;
                const active = game.pairPreset === opt;
                return (
                  <button
                    key={String(opt)}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setGame((g) => ({ ...g, pairPreset: opt }))
                    }
                    className={`rounded-lg border px-3 py-2 text-[12px] font-medium ${
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
              disabled={meta.deck.length < 3}
              onClick={() => beginRound(game.pairPreset)}
              className="mt-6 rounded-md bg-[#2F3437] px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Начать (
              {game.pairPreset === "all" ? "все" : game.pairPreset} пар · до{" "}
              {maxLabel})
            </button>
          </div>
        ) : (
          <>
            {game.phase === "play" &&
              game.matched.length === game.cards.length &&
              game.cards.length > 0 && (
                <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 text-[12px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
                  {game.sync === "submitting"
                    ? "Отправляем результаты…"
                    : "Все пары соединены."}
                  {timerOn ? ` · ${mm}:${ss}` : ""}
                </div>
              )}

            <div
              ref={boardRef}
              className={`relative min-h-[280px] rounded-xl border border-neutral-200/80 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/80 ${
                locked ? "pointer-events-none select-none opacity-95" : ""
              }`}
            >
              <svg
                className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
                aria-hidden
              >
                {lines.map((s) => (
                  <line
                    key={s.key}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    stroke={s.stroke}
                    strokeWidth={s.sw}
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
                      const matched = game.matched.includes(q.id);
                      const selected = game.pickQ === q.id;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          ref={(el) => setQRef(q.id, el)}
                          disabled={matched || locked}
                          onClick={() => {
                            if (matched || locked) return;
                            setGame((g) => ({
                              ...g,
                              pickQ: g.pickQ === q.id ? null : q.id,
                            }));
                          }}
                          className={tileCls("q", q.id, matched, selected)}
                        >
                          {preview(q.text)}
                        </button>
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
                      const matched = game.matched.includes(a.id);
                      const selected = game.pickA === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          ref={(el) => setARef(a.id, el)}
                          disabled={matched || locked}
                          onClick={() => {
                            if (matched || locked) return;
                            setGame((g) => ({
                              ...g,
                              pickA: g.pickA === a.id ? null : a.id,
                            }));
                          }}
                          className={tileCls("a", a.id, matched, selected)}
                        >
                          {preview(a.text)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {game.phase === "complete" ? (
              <div
                className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
                role="dialog"
                aria-modal
                aria-labelledby="matching-end-title"
              >
                <div className="w-full max-w-md rounded-2xl border border-emerald-200/90 bg-white p-6 shadow-xl dark:border-emerald-800 dark:bg-neutral-900">
                  <h2
                    id="matching-end-title"
                    className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
                  >
                    Раунд завершён
                  </h2>
                  {game.sync === "offline" ? (
                    <p className="mt-3 text-[13px] text-neutral-600 dark:text-neutral-300">
                      Нет сети — результат сохранён в браузере и будет отправлен
                      позже.
                    </p>
                  ) : game.summary ? (
                    <div className="mt-4 space-y-3 text-[13px] text-neutral-700 dark:text-neutral-200">
                      <p>
                        Уровень знаний темы:{" "}
                        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {game.summary.delta_knowledge_level >= 0 ? "+" : ""}
                          {game.summary.delta_knowledge_level.toFixed(1)} п.п.
                        </span>{" "}
                        (≈ {game.summary.topic_knowledge_after.toFixed(0)}%).
                      </p>
                      {game.summary.learning_efficiency_pct != null ? (
                        <p>
                          Эффективность (η):{" "}
                          <span className="font-semibold tabular-nums">
                            {game.summary.learning_efficiency_pct.toFixed(0)}%
                          </span>
                        </p>
                      ) : null}
                      <p className="text-[12px] text-neutral-500">
                        Прирост мастерства в matching с коэффициентом 0.7 задаётся
                        на сервере; интервалы SM-2 обновлены.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[13px] text-neutral-600">
                      Прогресс синхронизирован.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard?refresh=1")}
                    className="mt-6 w-full rounded-md bg-[#2F3437] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                  >
                    Завершить сессию
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
