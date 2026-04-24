import type { TopicCardListItem } from "@/lib/api/content";

/**
 * Оставляет карточки, пригодные для UI сопоставления:
 * нужен непустой вопрос и непустой ответ.
 *
 * Важно: раньше мы отбрасывали карточки, где вопрос и ответ "одинаковы" после
 * LaTeX-нормализации. Это часто блокировало сопоставление для колод с формулами
 * (например, `$x^2$` vs `x^2`). Для пользователя это выглядит как «карточек
 * достаточно, но режим не запускается», поэтому оставляем более мягкий фильтр.
 */
export function filterTopicCardsUsableInMatchingMode(
  allTopicCards: TopicCardListItem[]
): TopicCardListItem[] {
  return allTopicCards.filter((topicCard) => {
    const hasQuestionText = topicCard.question_text.trim().length > 0;
    const hasAnswerText = topicCard.answer_text.trim().length > 0;
    return hasQuestionText && hasAnswerText;
  });
}
