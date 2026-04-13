import type { TopicCardListItem } from "@/lib/api/content";
import { sameCardText } from "@/lib/card-text";

/** Оставляет карточки с непустыми и различающимися текстами вопроса и ответа. */
export function filterTopicCardsUsableInMatchingMode(
  allTopicCards: TopicCardListItem[]
): TopicCardListItem[] {
  return allTopicCards.filter((topicCard) => {
    const hasQuestionText = topicCard.question_text.trim().length > 0;
    const hasAnswerText = topicCard.answer_text.trim().length > 0;
    const questionDiffersFromAnswer = !sameCardText(
      topicCard.question_text,
      topicCard.answer_text
    );
    return hasQuestionText && hasAnswerText && questionDiffersFromAnswer;
  });
}
