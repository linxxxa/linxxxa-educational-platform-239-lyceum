/**
 * Часы обучения (дробные) → «24 мин» или «1ч 15мин» для дашборда.
 */
export function formatStudyTimeHours(hours: number): string {
  const h = Math.max(0, Number(hours));
  if (!Number.isFinite(h)) return "0 мин";
  const totalMinutes = Math.round(h * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} мин`;
  }
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  if (mm === 0) return `${hh}ч`;
  return `${hh}ч ${mm}мин`;
}
