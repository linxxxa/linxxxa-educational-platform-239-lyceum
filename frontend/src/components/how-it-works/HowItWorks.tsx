"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  Puzzle,
  Share2,
  Target,
  Zap,
} from "lucide-react";

const easeOut = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5, ease: easeOut },
};

const sectionStaggerParent = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.06 },
  },
};

const sectionStaggerChild = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: easeOut },
  },
};

const listStaggerParent = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.04 },
  },
};

const listStaggerChild = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.42, ease: easeOut },
  },
};

/** Карточка в духе FeaturesSection / MetricCard: border zinc, без лишних теней */
const cardBase =
  "rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900";

export function HowItWorks() {
  return (
    <div className="px-4 pb-16 sm:pb-20">
      <header className="mx-auto max-w-3xl pt-4 text-center sm:pt-6">
        <motion.h1
          className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: easeOut }}
        >
          EduLab: Наука за твоим прогрессом
        </motion.h1>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-zinc-600 dark:text-zinc-400"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: easeOut }}
        >
          Узнай, как наши алгоритмы и когнитивные методики помогают тебе учиться
          эффективнее
        </motion.p>
      </header>

      <section
        className="mx-auto mt-16 max-w-4xl border-t border-zinc-200 pt-16 dark:border-zinc-800 sm:mt-20"
        aria-labelledby="modes-heading"
      >
        <motion.h2
          id="modes-heading"
          className="mb-10 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
          {...fadeUp}
        >
          Когнитивные режимы
        </motion.h2>
        <motion.div
          className="grid gap-8 sm:grid-cols-2"
          variants={sectionStaggerParent}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          <motion.article variants={sectionStaggerChild} className={cardBase}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <BrainCircuit className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              Active Recall (Классика)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Прямое извлечение ответа из памяти. Самый эффективный способ
              создания нейронных связей.
            </p>
            <span className="mt-4 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400">
              Вес в прогрессе: 1.0
            </span>
          </motion.article>

          <motion.article
            variants={sectionStaggerChild}
            whileHover={{
              x: [0, -3, 3, -3, 3, -2, 2, 0],
              transition: { duration: 0.45, ease: "easeInOut" },
            }}
            className={`${cardBase} cursor-default transition-colors hover:border-zinc-300 dark:hover:border-zinc-700`}
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <Puzzle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              Recognition (Матчинг)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Игровой режим соединения пар. Идеально для визуального закрепления
              ассоциаций и снижения когнитивной нагрузки.
            </p>
            <span className="mt-4 inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
              Вес в прогрессе: 0.7
            </span>
          </motion.article>
        </motion.div>
      </section>

      <section
        className="mx-auto mt-16 max-w-4xl border-t border-zinc-200 pt-16 dark:border-zinc-800 sm:mt-20"
        aria-labelledby="sm2-heading"
      >
        <motion.div className={cardBase} {...fadeUp}>
          <h2
            id="sm2-heading"
            className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Алгоритм интервальных повторений
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
            Мы используем модифицированную модель SM-2. Система анализирует твою
            оценку усилия (Q) и прогнозирует кривую забывания, назначая
            повторение именно в тот момент, когда информация начинает стираться
            из памяти.
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_minmax(0,280px)] lg:items-center">
            <figure
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/50"
              aria-label="Схематичная кривая забывания и окно повторения"
            >
              <svg
                viewBox="0 0 400 200"
                className="h-auto w-full"
                role="img"
                aria-hidden
              >
                <path
                  d="M 20 40 Q 120 160 380 175"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="stroke-zinc-500 dark:stroke-zinc-400"
                />
                <circle cx="200" cy="118" r="5" className="fill-green-600 dark:fill-green-500" />
                <line
                  x1="200"
                  y1="118"
                  x2="200"
                  y2="40"
                  className="stroke-green-600 opacity-50 dark:stroke-green-500"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x="210"
                  y="102"
                  className="fill-zinc-600 text-[11px] dark:fill-zinc-400"
                  style={{ fontSize: "11px" }}
                >
                  Окно повторения
                </text>
                <text
                  x="24"
                  y="26"
                  className="fill-zinc-500 text-[10px] dark:fill-zinc-500"
                  style={{ fontSize: "10px" }}
                >
                  Сила воспоминания
                </text>
                <text
                  x="300"
                  y="192"
                  className="fill-zinc-500 text-[10px] dark:fill-zinc-500"
                  style={{ fontSize: "10px" }}
                >
                  Время
                </text>
              </svg>
            </figure>

            <aside className="space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                <div className="text-[11px] font-sans font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Агрегированный уровень
                </div>
                <p className="mt-2 text-[13px] sm:text-sm">
                  Mastery = Σ(Weight × Q / 5) / Total Cards
                </p>
              </div>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Уровень знаний зависит от объёма колоды: чем больше карточек в
                расчёте, тем стабильнее средний показатель и тем точнее он
                отражает готовность по всей теме, а не по одному термину.
              </p>
            </aside>
          </div>
        </motion.div>
      </section>

      <section
        className="mx-auto mt-16 max-w-4xl border-t border-zinc-200 pt-16 dark:border-zinc-800 sm:mt-20"
        aria-labelledby="analytics-heading"
      >
        <motion.h2
          id="analytics-heading"
          className="mb-10 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
          {...fadeUp}
        >
          Аналитика и шеринг
        </motion.h2>
        <motion.ul
          className="space-y-6"
          variants={listStaggerParent}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {[
            {
              icon: Zap,
              title: "Real-time аналитика",
              body: "Мгновенный пересчёт эффективности после каждой сессии.",
            },
            {
              icon: Share2,
              title: "Бесшовный шеринг",
              body: "При получении колоды по ссылке или email статистика сбрасывается для нового пользователя — его прогресс остаётся чистым и независимым.",
            },
            {
              icon: Target,
              title: "Зоны роста",
              body: "Автоматическое определение тем, требующих немедленного внимания.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <motion.li
              key={title}
              variants={listStaggerChild}
              className={`flex gap-4 ${cardBase}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {body}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <motion.footer
        className="mx-auto mt-16 max-w-lg border-t border-zinc-200 pt-12 text-center dark:border-zinc-800 sm:mt-20"
        {...fadeUp}
      >
        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center rounded-lg bg-[#2F3437] px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-[0.85] sm:w-auto dark:bg-neutral-100 dark:text-neutral-900 dark:hover:opacity-90"
        >
          Попробовать в деле
        </Link>
      </motion.footer>
    </div>
  );
}
