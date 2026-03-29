"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";
import { useAuthState } from "@/hooks/useAuthState";

interface FooterProps {
  className?: string;
}

export function Footer({ className = "" }: FooterProps) {
  const router = useRouter();
  const authed = useAuthState();

  const handleLogout = () => {
    clearToken();
    router.push("/");
  };

  return (
    <footer
      className={`border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 ${className}`.trim()}
    >
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            © {new Date().getFullYear()} ФМЛ 239 — Адаптивное обучение
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {authed ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Учёба
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Вход
                </Link>
                <Link
                  href="/register"
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Регистрация
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </footer>
  );
}
