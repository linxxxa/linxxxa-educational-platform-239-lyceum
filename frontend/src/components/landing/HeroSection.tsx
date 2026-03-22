import Link from "next/link";

export function HeroSection() {
  return (
    <section className="px-4 py-20 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
        Интеллектуальная система адаптивного обучения
      </h1>
      <p className="mx-auto mb-8 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
        Изучайте физику эффективнее с персонализированными карточками и
        алгоритмом SM-2
      </p>
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          href="/register"
          className="rounded-lg bg-zinc-900 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Начать обучение
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-300 px-6 py-3 text-base font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
        >
          Войти
        </Link>
      </div>
    </section>
  );
}
