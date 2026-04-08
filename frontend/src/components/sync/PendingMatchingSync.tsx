"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  clearMatchingPending,
  loadMatchingPending,
  postMatchingBatch,
} from "@/lib/matching-batch-sync";

/**
 * При загрузке приложения: досылаем результаты сопоставления, сохранённые офлайн.
 */
export function PendingMatchingSync() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const t = getToken();
      if (!t) return;
      const pending = loadMatchingPending();
      if (!pending?.results?.length) return;
      setNotice("У нас есть результаты твоей прошлой игры, сохраняем их…");
      try {
        const res = await postMatchingBatch({
          topic_id: pending.topic_id,
          session_id: pending.session_id,
          results: pending.results,
          total_response_time_ms: pending.total_response_time_ms,
        });
        if (!res.ok) throw new Error(String(res.status));
        if (cancelled) return;
        clearMatchingPending();
        setNotice(null);
        window.dispatchEvent(new CustomEvent("edulab-dashboard-refresh"));
        router.refresh();
      } catch {
        if (!cancelled) {
          setNotice(
            "Не удалось отправить сохранённые результаты. Попробуйте позже."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[120] max-w-md -translate-x-1/2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-[13px] text-emerald-950 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
    >
      {notice}
    </div>
  );
}
