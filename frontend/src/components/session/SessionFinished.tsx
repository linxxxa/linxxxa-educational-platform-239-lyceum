import Link from "next/link";
import type { SessionState } from "./types";

export default function SessionFinished({
  session,
}: {
  session: SessionState | null;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-[400px] rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <span className="text-[18px]">✓</span>
        </div>

        <h2 className="mb-2 text-[20px] font-medium text-neutral-900 dark:text-neutral-100">
          Сессия завершена
        </h2>
        <p className="mb-7 text-[13px] text-neutral-500">
          Когнитивный ресурс исчерпан. Хорошее время для перерыва.
        </p>

        {session && (
          <div className="mb-7 grid grid-cols-2 gap-3">
            <StatCard label="Карточек" value={session.cards_done} />
            <StatCard label="Осталось E" value={Math.round(session.energy)} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/stats"
            className="w-full rounded-md bg-[#2F3437] py-2.5 text-center text-[13px] font-medium text-white transition-opacity hover:opacity-[0.85]"
          >
            Посмотреть статистику →
          </Link>
          <Link
            href="/dashboard"
            className="w-full py-2.5 text-center text-[13px] text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
      <div className="text-[20px] font-medium text-neutral-900 dark:text-neutral-100">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}
