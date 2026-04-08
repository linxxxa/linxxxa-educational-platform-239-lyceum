"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  acceptDeckShareToken,
  fetchDeckSharePreview,
} from "@/lib/api/deck-share";
import { getToken, PENDING_DECK_SHARE_TOKEN_KEY } from "@/lib/auth";

export default function DeckShareClient({ token }: { token: string }) {
  const router = useRouter();
  const [title, setTitle] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const didRunRef = useRef(false);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const preview = (await fetchDeckSharePreview(token)) as {
      valid?: boolean;
      topic_title?: string | null;
      expired_or_used?: boolean;
    };
    if (preview?.valid === false) {
      setErr(
        preview.expired_or_used
          ? "Ссылка уже использована или срок действия истёк."
          : "Ссылка недействительна."
      );
      setBusy(false);
      return;
    }
    if (preview?.topic_title) setTitle(preview.topic_title);

    const jwt = getToken();
    if (!jwt) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PENDING_DECK_SHARE_TOKEN_KEY, token);
      }
      const next = `/decks/share/${encodeURIComponent(token)}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    try {
      const r = await acceptDeckShareToken(token);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PENDING_DECK_SHARE_TOKEN_KEY);
      }
      router.replace(
        `/dashboard?deckId=${r.cloned_topic_unique_identifier}`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }, [token, router]);

  if (!didRunRef.current) {
    didRunRef.current = true;
    void run();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          {busy && !err ? "Приглашение…" : err ? "Не удалось принять" : "Готово"}
        </h1>
        {title && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {title}
          </p>
        )}
        {err && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>
        )}
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm text-neutral-600 underline dark:text-neutral-400"
        >
          На дашборд
        </Link>
      </div>
    </main>
  );
}
