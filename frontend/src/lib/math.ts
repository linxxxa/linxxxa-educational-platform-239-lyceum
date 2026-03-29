/**
 * Затухание освоения (Эббингауз), согласовано с backend/app/services/mastery_decay.py:
 * M_current = M_initial * exp(-k * t), k = 0.0008 * H(T).
 */
export function calculateDecay(
  initialM: number,
  lastDate: Date | string | null | undefined,
  complexityH: number,
  now: Date = new Date()
): number {
  const m0 = Math.max(0, Math.min(100, initialM));
  if (m0 <= 0) return 0;
  if (lastDate == null) return m0;
  const last = typeof lastDate === "string" ? new Date(lastDate) : lastDate;
  const hoursPassed = Math.max(
    0,
    (now.getTime() - last.getTime()) / (1000 * 60 * 60)
  );
  const h = Math.max(0.05, Math.min(6, complexityH));
  const k = 0.0008 * h;
  return Math.max(0, Math.min(100, m0 * Math.exp(-k * hoursPassed)));
}
