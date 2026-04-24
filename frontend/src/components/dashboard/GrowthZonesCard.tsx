"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { fetchFilteredDeckForMatchingTopic } from "@/components/session/matching-mode/fetchFilteredDeckForMatchingTopic";
import { MIN_TOPIC_CARDS_FOR_MATCHING } from "@/components/session/matching-mode/matchingModeConstants";

type StudyMode = "classic" | "match" | "sprint";

export interface GrowthZone {
  topic_id?: number;
  name: string;
  mastery: number;
  complexity: number;
  status: "warn" | "mid" | "ok";
}

const cfg = {
  warn: {
    label: "Нужно внимание",
    bar: "#dc2626",
    badge: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  },
  mid: {
    label: "В процессе",
    bar: "#ea580c",
    badge: "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  },
  ok: {
    label: "В процессе",
    bar: "#ea580c",
    badge: "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  },
};

function parseTopicIdFromStudyHref(href: string): number | null {
  try {
    const u = new URL(href, "http://local.invalid");
    const m = u.pathname.match(/^\/study\/(\d+)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function zoneVisualStatus(zone: GrowthZone): "warn" | "mid" {
  if (zone.status === "warn" || zone.status === "mid") return zone.status;
  return zone.mastery < 50 ? "warn" : "mid";
}

interface GrowthZonesCardProps {
  zones: GrowthZone[];
  firstStudyHref?: string | null;
  /** Если true и список зон пуст — показываем «все темы в порядке». */
  showAllClearMessage?: boolean;
  /** Если true — скрываем кнопку «Начать тренировку». */
  hideStartButton?: boolean;
}

export default function GrowthZonesCard({
  zones,
  firstStudyHref,
  showAllClearMessage = false,
  hideStartButton = false,
}: GrowthZonesCardProps) {
  const [modeOpen, setModeOpen] = useState(false);
  /** После выбора «Сопоставление» — показываем число пар и таймер. */
  const [matchConfigStep, setMatchConfigStep] = useState(false);
  const [matchPreflightError, setMatchPreflightError] = useState<string | null>(
    null
  );
  const [pairs, setPairs] = useState<"5" | "10" | "all">(() => {
    try {
      const savedPairs = localStorage.getItem("edulab.match.pairs");
      if (savedPairs === "5" || savedPairs === "10" || savedPairs === "all") {
        return savedPairs;
      }
    } catch {}
    return "10";
  });
  const [timerOn, setTimerOn] = useState(() => {
    try {
      return localStorage.getItem("edulab.match.timer") === "1";
    } catch {
      return false;
    }
  });

  const clickSound = useCallback(() => {
    try {
      const w = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 740;
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      window.setTimeout(() => {
        o.stop();
        ctx.close().catch(() => {});
      }, 45);
    } catch {}
  }, []);

  const buildHref = useCallback(
    (mode: StudyMode) => {
      if (!firstStudyHref) return null;
      if (mode === "classic") return firstStudyHref;
      const u = new URL(firstStudyHref, "http://local");
      if (mode === "match") {
        u.searchParams.set("mode", "match");
        u.searchParams.set("pairs", pairs);
        if (timerOn) u.searchParams.set("timer", "1");
      } else if (mode === "sprint") {
        u.searchParams.set("mode", "sprint");
        if (timerOn) u.searchParams.set("timer", "1");
      }
      return `${u.pathname}${u.search}`;
    },
    [firstStudyHref, pairs, timerOn]
  );

  const startMode = useCallback(
    (mode: StudyMode, options?: { skipMatchPreflight?: boolean }) => {
      void (async () => {
        if (
          mode === "match" &&
          firstStudyHref &&
          !options?.skipMatchPreflight
        ) {
          const topicId = parseTopicIdFromStudyHref(firstStudyHref);
          if (topicId != null) {
            try {
              const filtered = await fetchFilteredDeckForMatchingTopic(topicId);
              if (filtered.length < MIN_TOPIC_CARDS_FOR_MATCHING) {
                setMatchPreflightError(
                  "В этой колоде слишком мало карточек для сопоставления (нужно минимум три с непустым вопросом и ответом)."
                );
                return;
              }
            } catch {
              setMatchPreflightError(
                "Не удалось проверить колоду. Попробуйте позже."
              );
              return;
            }
          }
        }
        setMatchPreflightError(null);
        const href = buildHref(mode);
        if (!href) return;
        clickSound();
        try {
          localStorage.setItem("edulab.study.mode", mode);
          if (mode === "match") {
            localStorage.setItem("edulab.match.pairs", pairs);
            localStorage.setItem("edulab.match.timer", timerOn ? "1" : "0");
          }
        } catch {}
        window.location.href = href;
      })();
    },
    [buildHref, clickSound, firstStudyHref, pairs, timerOn]
  );

  const onPickMatchMode = useCallback(() => {
    setMatchPreflightError(null);
    void (async () => {
      if (!firstStudyHref) return;
      const topicId = parseTopicIdFromStudyHref(firstStudyHref);
      if (topicId != null) {
        try {
          const filtered = await fetchFilteredDeckForMatchingTopic(topicId);
          if (filtered.length < MIN_TOPIC_CARDS_FOR_MATCHING) {
            setMatchPreflightError(
              "В этой колоде слишком мало карточек для сопоставления (нужно минимум три с непустым вопросом и ответом)."
            );
            return;
          }
        } catch {
          setMatchPreflightError(
            "Не удалось проверить колоду. Попробуйте позже."
          );
          return;
        }
      }
      setMatchPreflightError(null);
      setMatchConfigStep(true);
    })();
  }, [firstStudyHref]);

  const canOpen = Boolean(firstStudyHref);
  const openLabel = useMemo(() => "Начать тренировку →", []);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-medium text-neutral-900 dark:text-neutral-100">
        Зоны роста
      </p>
      <p className="mb-4 text-[11px] text-neutral-400">
        Темы, где освоение ниже 80% (с учётом времени с последней сессии)
      </p>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {zones.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-neutral-500">
            {showAllClearMessage ? (
              <>
                Все темы в порядке! Отдохни или повтори избранное.
              </>
            ) : (
              <>Пока нет данных по темам — начните с колод ниже.</>
            )}
          </p>
        ) : (
          zones.map((zone) => {
            const visual = zoneVisualStatus(zone);
            return (
              <div
                key={zone.topic_id ?? zone.name}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-neutral-100 p-2.5 dark:border-neutral-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-neutral-900 dark:text-neutral-100">
                    {zone.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-neutral-400">
                    Освоено {zone.mastery}% · сложность H(T){" "}
                    {zone.complexity.toFixed(2)}
                  </p>
                  <div className="mt-1.5 h-[3px] rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <div
                      className="h-[3px] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, zone.mastery))}%`,
                        background: cfg[visual].bar,
                      }}
                    />
                  </div>
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-medium ${cfg[visual].badge}`}
                >
                  {cfg[visual].label}
                </span>
              </div>
            );
          })
        )}
      </div>

      {hideStartButton ? null : (
        <button
          type="button"
          disabled={!canOpen}
          onClick={() => {
            if (!canOpen) return;
            setMatchPreflightError(null);
            setMatchConfigStep(false);
            setModeOpen(true);
          }}
          className={`mt-4 w-full rounded-lg border py-2 text-center text-[12px] font-medium transition-colors ${
            canOpen
              ? "border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              : "cursor-not-allowed border-neutral-200 text-neutral-400 dark:border-neutral-700"
          }`}
        >
          {openLabel}
        </button>
      )}

      <AnimatePresence>
        {modeOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setMatchPreflightError(null);
              setMatchConfigStep(false);
              setModeOpen(false);
            }}
            role="presentation"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
              role="dialog"
              aria-label="Выбор режима"
            >
              <div className="mb-4">
                <p className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
                  {matchConfigStep
                    ? "Сопоставление: настройки"
                    : "Выберите режим"}
                </p>
                <p className="mt-1 text-[12px] text-neutral-500">
                  {matchConfigStep
                    ? "Выберите число пар и при необходимости включите таймер."
                    : "Режим запоминается и будет предлагаться по умолчанию."}
                </p>
              </div>

              {matchConfigStep ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                      <div className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                        Число пар
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(["5", "10", "all"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPairs(p)}
                            className={`rounded-md border px-3 py-1 text-[11px] ${
                              pairs === p
                                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                                : "border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                            }`}
                          >
                            {p === "all" ? "все пары" : `${p} пар`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                      <div className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                        На время
                      </div>
                      <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={timerOn}
                          onChange={(e) => setTimerOn(e.target.checked)}
                        />
                        Включить таймер
                      </label>
                    </div>
                  </div>

                  {matchPreflightError ? (
                    <p className="mt-3 text-[12px] text-red-600 dark:text-red-400">
                      {matchPreflightError}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMatchPreflightError(null);
                        setMatchConfigStep(false);
                      }}
                      className="rounded-md border border-neutral-200 px-4 py-2 text-[12px] text-neutral-700 dark:border-neutral-800 dark:text-neutral-200"
                    >
                      ← К режимам
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startMode("match", { skipMatchPreflight: true })
                      }
                      className="rounded-md bg-[#2F3437] px-4 py-2 text-[12px] font-medium text-white hover:opacity-90"
                    >
                      Начать сопоставление
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2 md:grid-cols-3">
                    {[
                      {
                        id: "classic" as const,
                        title: "Классика",
                        desc: "Переворачивание карточек (Q-оценки)",
                      },
                      {
                        id: "match" as const,
                        title: "Сопоставление",
                        desc: "Соединение пар (ассоциации)",
                      },
                      {
                        id: "sprint" as const,
                        title: "Спринт",
                        desc: "Верно/Неверно на время",
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          m.id === "match"
                            ? onPickMatchMode()
                            : startMode(m.id)
                        }
                        className="group rounded-xl border border-neutral-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
                      >
                        <div className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                          {m.title}
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {m.desc}
                        </div>
                      </button>
                    ))}
                  </div>

                  {matchPreflightError ? (
                    <p className="mt-3 text-[12px] text-red-600 dark:text-red-400">
                      {matchPreflightError}
                    </p>
                  ) : null}

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMatchPreflightError(null);
                        setMatchConfigStep(false);
                        setModeOpen(false);
                      }}
                      className="rounded-md border border-neutral-200 px-4 py-2 text-[12px] text-neutral-700 dark:border-neutral-800 dark:text-neutral-200"
                    >
                      Закрыть
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
