/**
 * Подпись к баллу 0–100 (видимая метрика; внутренний RI остаётся на сервере).
 */
export function knowledgeLevelLabel(score: number): string {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s <= 30) return "Только начинаем";
  if (s <= 60) return "Средний уровень";
  if (s <= 90) return "Хорошая подготовка";
  return "Готов к экзамену на все 100!";
}
