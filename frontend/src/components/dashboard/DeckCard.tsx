"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { shareDeckByEmail } from "@/lib/api/content";

export interface Deck {
  id: number;
  name: string;
  connections: number;
  mastery: number;
}

interface DeckCardProps {
  deck: Deck;
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

function validateEmailClient(raw: string): string | null {
  const s = raw.trim();
  if (s.length < 5 || s.length > 255) {
    return "Укажите email от 5 до 255 символов";
  }
  const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basic.test(s)) {
    return "Некорректный формат email";
  }
  return null;
}

export default function DeckCard({ deck }: DeckCardProps) {
  const m = Math.min(100, Math.max(0, deck.mastery));
  const [shareOpen, setShareOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareOk, setShareOk] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeShare = useCallback(() => {
    setShareOpen(false);
    setEmail("");
    setShareError(null);
    setShareOk(null);
    setShareLoading(false);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeShare();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shareOpen, closeShare]);

  const submitShare = useCallback(async () => {
    setShareError(null);
    setShareOk(null);
    const ve = validateEmailClient(email);
    if (ve) {
      setShareError(ve);
      return;
    }
    setShareLoading(true);
    try {
      const r = await shareDeckByEmail(deck.id, email.trim());
      setShareOk(
        `Отправлено: ${r.cards_copied_count} карточек скопировано получателю.`
      );
      setEmail("");
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setShareLoading(false);
    }
  }, [deck.id, email]);

  return (
    <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-start gap-1.5">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
          {deck.name}
        </p>
        <button
          type="button"
          title="Отправить другу"
          aria-label="Отправить колоду другу по email"
          onClick={() => {
            setShareOpen(true);
            setShareError(null);
            setShareOk(null);
          }}
          className="shrink-0 rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <ShareIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <span className="shrink-0 whitespace-nowrap rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:border-neutral-700">
          Связей: {deck.connections}
        </span>
      </div>

      <div className="mb-3 h-[2px] rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div
          className="h-[2px] rounded-full bg-[#2F3437] transition-all duration-500"
          style={{ width: `${m}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Link
          href={`/study/${deck.id}`}
          className="inline-flex w-full shrink-0 items-center justify-center whitespace-nowrap rounded bg-[#2F3437] px-2.5 py-2.5 text-[11px] font-medium text-white transition-opacity hover:opacity-[0.85] md:w-auto md:py-1.5"
        >
          Повторить
        </Link>
        <div className="relative ml-auto md:ml-0" ref={menuRef}>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="Дополнительные действия"
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <span className="text-lg leading-none">⋯</span>
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              role="menu"
            >
              <Link
                href={`/dashboard/topics?focus=${deck.id}`}
                role="menuitem"
                className="block px-3 py-2 text-[11px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                onClick={() => setMenuOpen(false)}
              >
                Управлять
              </Link>
              <Link
                href={`/dashboard/topics/${deck.id}/cards/add`}
                role="menuitem"
                className="block px-3 py-2 text-[11px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                onClick={() => setMenuOpen(false)}
              >
                + Карточки
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {shareOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={closeShare}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
            role="dialog"
            aria-labelledby="share-deck-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="share-deck-title"
              className="mb-1 text-[15px] font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Отправить колоду другу
            </h2>
            <p className="mb-4 text-[12px] text-neutral-500">
              Укажите email зарегистрированного пользователя EduLab. Ему будет
              создана копия колоды без вашего прогресса повторений.
            </p>
            <label className="mb-1 block text-[12px] text-neutral-500">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="mb-3 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] dark:border-neutral-800 dark:bg-neutral-900"
            />
            {shareError ? (
              <p className="mb-3 text-[12px] text-red-600 dark:text-red-400">
                {shareError}
              </p>
            ) : null}
            {shareOk ? (
              <p className="mb-3 text-[12px] text-emerald-600 dark:text-emerald-400">
                {shareOk}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeShare}
                className="rounded-md border border-neutral-200 px-4 py-2 text-[13px] text-neutral-700 dark:border-neutral-800 dark:text-neutral-200"
              >
                Закрыть
              </button>
              <button
                type="button"
                disabled={shareLoading}
                onClick={() => void submitShare()}
                className="rounded-md bg-[#2F3437] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {shareLoading ? "Отправка…" : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
