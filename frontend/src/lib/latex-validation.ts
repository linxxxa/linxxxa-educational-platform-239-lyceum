/** Базовая проверка перед отправкой (согласовано с бэкендом). */

function doubleDollarCount(tex: string): number {
  const m = tex.match(/\$\$/g);
  return m ? m.length : 0;
}

export function validateLatexDelimiters(tex: string): string | null {
  if (tex.trim().length === 0) return "Поле не может быть пустым";
  if (tex.length > 100_000) return "Слишком длинный текст";
  if (doubleDollarCount(tex) % 2 !== 0) return "Незакрытый блок $$";
  return null;
}

export function validateCardPair(
  question: string,
  answer: string
): string | null {
  return (
    validateLatexDelimiters(question) ?? validateLatexDelimiters(answer) ?? null
  );
}
