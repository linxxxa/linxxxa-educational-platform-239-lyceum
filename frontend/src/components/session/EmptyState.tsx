import Link from "next/link";

export default function EmptyState() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-[400px] rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <p className="mb-2 text-[16px] font-medium text-neutral-900 dark:text-neutral-100">
          На сегодня карточек нет
        </p>
        <p className="mb-6 text-[13px] text-neutral-500">
          Добавьте темы или вернитесь позже — новые повторения появятся по
          расписанию.
        </p>
        <Link
          href="/"
          className="text-[13px] text-neutral-600 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          На главную →
        </Link>
      </div>
    </div>
  );
}
