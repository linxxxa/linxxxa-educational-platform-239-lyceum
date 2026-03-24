"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

/**
 * Состояние «пользователь залогинен» по токену в localStorage.
 * Синхронизируется между вкладками (storage) и после login/logout (custom event).
 */
export function useAuthState(): boolean {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(!!getToken());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("edulab-auth-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("edulab-auth-change", sync);
    };
  }, []);

  return authed;
}
