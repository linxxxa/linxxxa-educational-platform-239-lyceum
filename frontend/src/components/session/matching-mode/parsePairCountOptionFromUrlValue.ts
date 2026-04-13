import type { PairCountOption } from "@/lib/matching-subset";

/**
 * Разбирает значение query-параметра (например pairs=10) в число пар или «все».
 */
export function parsePairCountOptionFromUrlValue(
  urlQueryValue: string | null | undefined
): PairCountOption {
  if (urlQueryValue === "5") return 5;
  if (urlQueryValue === "10") return 10;
  if (urlQueryValue === "15") return 15;
  if (urlQueryValue === "all") return "all";
  return 10;
}
