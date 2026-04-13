/** Форматирует секунды таймера как MM:SS для строки статуса. */
export function formatElapsedSecondsForTimerDisplay(
  elapsedSecondsTotal: number
): { minutesTwoDigits: string; secondsTwoDigits: string } {
  const wholeMinutes = Math.floor(elapsedSecondsTotal / 60);
  const secondsRemainder = elapsedSecondsTotal % 60;
  return {
    minutesTwoDigits: String(wholeMinutes).padStart(2, "0"),
    secondsTwoDigits: String(secondsRemainder).padStart(2, "0"),
  };
}
