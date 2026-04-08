import type { TopicCardListItem } from "@/lib/api/content";

export type PairCountOption = 5 | 10 | 15 | "all";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Берёт до `count` карточек с наименьшим mastery_level (слабые первыми),
 * затем перемешивает порядок в раунде.
 */
export function getShuffledSubset(
  deck: TopicCardListItem[],
  count: PairCountOption
): TopicCardListItem[] {
  if (deck.length === 0) return [];
  const cap = count === "all" ? deck.length : Math.min(count, deck.length);
  const sorted = [...deck].sort(
    (a, b) => (a.mastery_level ?? 0) - (b.mastery_level ?? 0)
  );
  const weakest = sorted.slice(0, cap);
  return shuffle(weakest);
}
