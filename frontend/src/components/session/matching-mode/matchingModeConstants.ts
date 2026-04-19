import type { PairCountOption } from "@/lib/matching-subset";

/**
 * Минимум карточек темы после фильтра (непустые вопрос/ответ и тексты различаются),
 * иначе раунд сопоставления невозможен.
 */
export const MIN_TOPIC_CARDS_FOR_MATCHING = 3;

/** Цвет линии для уже сопоставленной верной пары (полупрозрачный изумрудный). */
export const MATCHING_SVG_LINE_STROKE_COLOR_CORRECT_PAIR =
  "rgba(16, 185, 129, 0.5)";

/** Цвет линии при ошибочном сопоставлении. */
export const MATCHING_SVG_LINE_STROKE_COLOR_MISMATCH_PAIR = "#ef4444";

/** Доступные пользователю варианты числа пар в раунде. */
export const MATCHING_PAIR_COUNT_OPTIONS_LIST: PairCountOption[] = [
  5,
  10,
  15,
  "all",
];
