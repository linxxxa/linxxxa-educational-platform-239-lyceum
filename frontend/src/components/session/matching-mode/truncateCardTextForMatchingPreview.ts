/** Сжимает текст карточки для отображения на плитке (одна строка с многоточием). */
export function truncateCardTextForMatchingPreview(
  fullCardText: string,
  maximumVisibleLength = 90
): string {
  const normalizedSingleLine = fullCardText.replace(/\s+/g, " ").trim();
  if (!normalizedSingleLine) return "—";
  if (normalizedSingleLine.length <= maximumVisibleLength) {
    return normalizedSingleLine;
  }
  return `${normalizedSingleLine.slice(0, maximumVisibleLength - 1)}…`;
}
