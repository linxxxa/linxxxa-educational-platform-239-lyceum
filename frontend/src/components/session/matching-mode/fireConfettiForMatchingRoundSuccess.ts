import { playFullscreenConfetti } from "@/lib/playFullscreenConfetti";

/** Короткая праздничная анимация после успешной отправки batch на сервер. */
export function fireConfettiForMatchingRoundSuccess(): void {
  playFullscreenConfetti("celebration");
}
