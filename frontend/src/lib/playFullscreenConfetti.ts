"use client";

import confetti from "canvas-confetti";

const CELEBRATION_COLORS = [
  "#10b981",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
];

const SUBTLE_COLORS = ["#94a3b8", "#cbd5e1", "#e2e8f0", "#64748b"];

export type PlayFullscreenConfettiVariant = "celebration" | "subtle";

/**
 * Рисует конфетти на отдельном canvas поверх всего UI (z-index максимальный),
 * чтобы анимация не пряталась под модалками и слоями Next/React.
 */
export function playFullscreenConfetti(
  variant: PlayFullscreenConfettiVariant = "celebration"
): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = "fixed";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "2147483646";
  canvas.style.margin = "0";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const shooter = confetti.create(canvas, {
    resize: true,
    useWorker: false,
    disableForReducedMotion: true,
  });

  const colors = variant === "celebration" ? CELEBRATION_COLORS : SUBTLE_COLORS;
  const particleCount = variant === "celebration" ? 165 : 75;

  const fire = () => {
    void shooter({
      particleCount,
      spread: variant === "celebration" ? 80 : 68,
      startVelocity: variant === "celebration" ? 50 : 36,
      origin: { x: 0.5, y: 0.55 },
      colors,
      ticks: 320,
    });
    if (variant === "celebration") {
      window.setTimeout(() => {
        void shooter({
          particleCount: 55,
          angle: 60,
          spread: 52,
          origin: { x: 0, y: 0.72 },
          colors,
        });
        void shooter({
          particleCount: 55,
          angle: 120,
          spread: 52,
          origin: { x: 1, y: 0.72 },
          colors,
        });
      }, 160);
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(fire);
  });

  window.setTimeout(() => {
    canvas.remove();
  }, 4800);
}
