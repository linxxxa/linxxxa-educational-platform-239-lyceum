import Link from "next/link";

export interface Deck {
  id: number;
  name: string;
  connections: number;
  isPublic: boolean;
  mastery: number;
}

interface DeckCardProps {
  deck: Deck;
}

export default function DeckCard({ deck }: DeckCardProps) {
  const m = Math.min(100, Math.max(0, deck.mastery));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-2 truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
        {deck.name}
      </p>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <span className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:border-neutral-700">
          Связей: {deck.connections}
        </span>
        <span className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:border-neutral-700">
          {deck.isPublic ? "Публичная" : "Приватная"}
        </span>
      </div>

      <div className="mb-3 h-[2px] rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div
          className="h-[2px] rounded-full bg-[#2F3437] transition-all duration-500"
          style={{ width: `${m}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Link
          href={`/study/${deck.id}`}
          className="inline-flex shrink-0 rounded bg-[#2F3437] px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-[0.85]"
        >
          Повторить
        </Link>
        <Link
          href={`/dashboard/topics?focus=${deck.id}`}
          className="shrink-0 text-[11px] text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          Управлять
        </Link>
        <Link
          href={`/dashboard/topics/${deck.id}/cards/add`}
          className="shrink-0 text-[11px] text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          + Карточки
        </Link>
      </div>
    </div>
  );
}
