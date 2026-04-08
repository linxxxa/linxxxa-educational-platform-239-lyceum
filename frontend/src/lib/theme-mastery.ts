/**
 * Освоение темы (колоды) по весам карточек и последнему Q (0–5).
 * Должно совпадать с backend theme_mastery_weighted_percent.
 */
export function calculateThemeMastery(
  lastQPerCard: (number | null | undefined)[]
): number {
  const n = lastQPerCard.length;
  if (n <= 0) return 0;
  const weight = 100 / n;
  let total = 0;
  for (const q of lastQPerCard) {
    if (q == null) continue;
    const qi = Math.floor(Number(q));
    if (!Number.isFinite(qi) || qi <= 2) continue;
    total += weight * (Math.min(5, Math.max(0, qi)) / 5);
  }
  return Math.max(0, Math.min(100, total));
}
