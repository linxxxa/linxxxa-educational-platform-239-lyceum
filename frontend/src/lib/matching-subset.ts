import type { TopicCardListItem } from "@/lib/api/content";

export type PairCountOption = 5 | 10 | 15 | "all";

export function shuffle<T>(arr: T[]): T[] {
  const mutableCopy = [...arr];
  for (
    let reverseWalkIndex = mutableCopy.length - 1;
    reverseWalkIndex > 0;
    reverseWalkIndex -= 1
  ) {
    const randomSwapPartnerIndex = Math.floor(
      Math.random() * (reverseWalkIndex + 1)
    );
    const tempItem = mutableCopy[reverseWalkIndex];
    mutableCopy[reverseWalkIndex] =
      mutableCopy[randomSwapPartnerIndex];
    mutableCopy[randomSwapPartnerIndex] = tempItem;
  }
  return mutableCopy;
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
    (leftTopicCard, rightTopicCard) =>
      (leftTopicCard.mastery_level ?? 0) -
      (rightTopicCard.mastery_level ?? 0)
  );
  const weakest = sorted.slice(0, cap);
  return shuffle(weakest);
}
