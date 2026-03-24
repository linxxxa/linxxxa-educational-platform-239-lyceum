import Link from "next/link";

export default function DashboardStatsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-xl font-medium text-neutral-900 dark:text-neutral-100">
        Статистика
      </h1>
      <p className="mb-6 text-center text-[13px] text-neutral-500">
        Раздел в разработке.
      </p>
      <Link
        href="/dashboard"
        className="text-[13px] text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        ← К учёбе
      </Link>
    </main>
  );
}
