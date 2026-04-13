/**
 * Один источник правды для Q в режиме сопоставления (узнавание):
 * 0 ошибок по карточке до успеха → 5; 1 ошибка → 3; иначе → 1.
 * Коэффициент 0.7 к приросту мастерства задаётся только на бэкенде при batch.
 */
export function matchingQualityFromWrongTouches(touches: number): 1 | 3 | 5 {
  if (touches <= 0) return 5;
  if (touches === 1) return 3;
  return 1;
}
