import type { TopicCardListItem } from "@/lib/api/content";
import { shuffle } from "@/lib/matching-subset";
import type { MatchingShuffledColumnTile } from "./matchingModeTypes";
import { truncateCardTextForMatchingPreview } from "./truncateCardTextForMatchingPreview";

/** Колонка вопросов: перемешанный порядок, текст уже усечён для превью. */
export function buildShuffledQuestionColumnTiles(
  roundCards: TopicCardListItem[]
): MatchingShuffledColumnTile[] {
  const unshuffled = roundCards.map((topicCard) => ({
    cardId: topicCard.card_id,
    previewText: truncateCardTextForMatchingPreview(topicCard.question_text),
  }));
  return shuffle(unshuffled);
}

/** Колонка ответов: перемешанный порядок, текст уже усечён для превью. */
export function buildShuffledAnswerColumnTiles(
  roundCards: TopicCardListItem[]
): MatchingShuffledColumnTile[] {
  const unshuffled = roundCards.map((topicCard) => ({
    cardId: topicCard.card_id,
    previewText: truncateCardTextForMatchingPreview(topicCard.answer_text),
  }));
  return shuffle(unshuffled);
}
