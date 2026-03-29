function normLoose(s: string): string {
  return s.replace(/\$\$/g, "").replace(/\$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Сравнение текста карточки без учёта оформления LaTeX и пробелов. */
export function sameCardText(a: string, b: string): boolean {
  return normLoose(a) === normLoose(b);
}

/**
 * Текст ответа уже показан во вопросе (совпадение или полное вхождение после нормализации).
 * Типично для карточек «формула» / «понятие», где вопрос содержит ту же формулу или определение.
 */
export function answerRedundantWithQuestion(question: string, answer: string): boolean {
  const na = normLoose(answer);
  if (na.length < 2) return false;
  if (sameCardText(question, answer)) return true;
  const nq = normLoose(question);
  return nq.includes(na);
}
