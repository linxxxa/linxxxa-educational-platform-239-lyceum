import { fetchCardsInTopic, type TopicCardListItem } from "@/lib/api/content";
import { filterTopicCardsUsableInMatchingMode } from "./filterTopicCardsUsableInMatchingMode";

/** Загружает карточки темы и отбрасывает неподходящие для matching. */
export async function fetchFilteredDeckForMatchingTopic(
  learningTopicId: number
): Promise<TopicCardListItem[]> {
  const rawTopicCards = await fetchCardsInTopic(learningTopicId, 400);
  return filterTopicCardsUsableInMatchingMode(rawTopicCards);
}
