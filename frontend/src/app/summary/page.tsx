"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const s = Math.floor(sec);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function MatchSummaryPage() {
  const sp = useSearchParams();
  const topicId = sp.get("topic_id");
  const sessionId = sp.get("session_id");
  const pairs = Number(sp.get("pairs") || "0");
  const errors = Number(sp.get("errors") || "0");
  const secs = Number(sp.get("secs") || "0");
  const timer = sp.get("timer") === "1";

  const avg =
    pairs > 0 && Number.isFinite(secs) ? (secs / pairs).toFixed(1) : "—";

  return (
    <div className="min-h-screen bg-neutral-100 px-6 py-10 dark:bg-neutral-950">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Результат: сопоставление
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {sessionId ? `Сессия: ${sessionId.slice(0, 8)}…` : null}
        </p>

        <div className="mt-8 space-y-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-neutral-500">Пар в раунде</span>
            <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
              {Number.isFinite(pairs) && pairs > 0 ? pairs : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-neutral-500">Ошибок сопоставления</span>
            <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
              {Number.isFinite(errors) ? errors : "—"}
            </span>
          </div>
          {timer ? (
            <>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-neutral-500">Время раунда</span>
                <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                  {formatSec(secs)}
                </span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-neutral-500">Среднее время на пару</span>
                <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                  {avg === "—" ? "—" : `${avg} с`}
                </span>
              </div>
            </>
          ) : null}
          <p className="border-t border-neutral-100 pt-4 text-xs text-neutral-500 dark:border-neutral-800">
            Точность: все пары собраны
            {Number.isFinite(errors) && errors > 0
              ? ` (${errors} неверных попыток до верного результата)`
              : " без ошибок"}
            .
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={topicId ? `/study/${topicId}?mode=match` : "/dashboard"}
            className="rounded-md bg-[#2F3437] px-4 py-2 text-sm font-medium text-white"
          >
            {topicId ? "Ещё раз" : "В Dashboard"}
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-neutral-200 px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
          >
            В Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
