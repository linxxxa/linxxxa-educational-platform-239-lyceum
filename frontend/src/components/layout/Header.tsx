"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";
import { useAuthState } from "@/hooks/useAuthState";

interface HeaderProps {
  className?: string;
  /** Ссылки Колоды → /dashboard/decks, Учёба → /dashboard/session */
  variant?: "default" | "dashboard";
}

function Header({ className, variant = "default" }: HeaderProps) {
  const router = useRouter();
  const authed = useAuthState();
  const mounted = true;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    clearToken();
    setMenuOpen(false);
    router.push("/");
  };

  // close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideMenu = menuRef.current?.contains(target);
      const isInsideBurger = burgerRef.current?.contains(target);
      if (menuOpen && !isInsideMenu && !isInsideBurger) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  /** Фон шапки всегда белый (в т.ч. в dark). */
  const headerBarClasses =
    variant === "dashboard"
      ? "border-b border-neutral-200/90 bg-white shadow-sm backdrop-blur-md dark:border-neutral-200 dark:bg-white"
      : "border-b border-neutral-200/80 bg-white dark:border-neutral-200 dark:bg-white";

  const headerInnerPad =
    variant === "dashboard" ? "px-4 sm:px-6 lg:px-8" : "px-5";

  const headerClassName = [
    "fixed left-0 right-0 top-0 z-[100] transition-all duration-200",
    headerBarClasses,
    className,
  ]
    .filter((s): s is string => Boolean(s && String(s).trim()))
    .join(" ");

  return (
    <header className={headerClassName}>
      <div
        className={`mx-auto flex h-14 max-w-5xl items-center justify-between ${headerInnerPad}`}
      >
        {/* Лого */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2F3437]">
            <span className="text-[10px] font-medium text-white">239</span>
          </div>
          <span className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
            EduLab
          </span>
        </Link>

        {/* Центральные ссылки (десктоп) */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="#about"
            className="text-[13px] text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            О платформе
          </Link>
          <Link
            href="#how"
            className="text-[13px] text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Как это работает
          </Link>
        </nav>

        {/* Кнопки (десктоп) */}
        <div className="hidden items-center gap-3 md:flex">
          {mounted && authed ? (
            variant === "dashboard" ? (
              <>
                <Link
                  href="/dashboard/decks"
                  className="text-[13px] text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  Колоды
                </Link>
                <Link
                  href="/dashboard/session"
                  className="rounded-md bg-[#2F3437] px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-[0.85]"
                >
                  Учёба →
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="text-[13px] text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard#decks"
                  className="text-[13px] text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  Колоды
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-md bg-[#2F3437] px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-[0.85]"
                >
                  Учёба →
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="text-[13px] text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  Выйти
                </button>
              </>
            )
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-[#2F3437] px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-[0.85]"
              >
                Начать бесплатно →
              </Link>
            </>
          )}
        </div>

        {/* Бургер (мобайл) */}
        <button
          ref={burgerRef}
          type="button"
          className="text-neutral-500 md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label="Открыть меню"
        >
          <div className="flex flex-col gap-1">
            <span className="block h-px w-5 bg-current" />
            <span className="block h-px w-5 bg-current" />
            <span className="block h-px w-5 bg-current" />
          </div>
        </button>
      </div>

      {/* Мобильное меню */}
      {menuOpen && (
        <div
          ref={menuRef}
          className={`flex flex-col gap-3 border-b border-neutral-200 bg-white pb-4 dark:border-neutral-200 dark:bg-white md:hidden animate-menu-fade-in ${headerInnerPad}`}
        >
          <Link
            href="#about"
            onClick={() => setMenuOpen(false)}
            className="py-1 text-[13px] text-neutral-500"
          >
            О платформе
          </Link>
          <Link
            href="#how"
            onClick={() => setMenuOpen(false)}
            className="py-1 text-[13px] text-neutral-500"
          >
            Как это работает
          </Link>
          {mounted && authed ? (
            variant === "dashboard" ? (
              <>
                <Link
                  href="/dashboard/decks"
                  onClick={() => setMenuOpen(false)}
                  className="py-1 text-[13px] text-neutral-500"
                >
                  Колоды
                </Link>
                <Link
                  href="/dashboard/session"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md bg-[#2F3437] px-3.5 py-2 text-center text-[13px] font-medium text-white"
                >
                  Учёба →
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="py-1 text-left text-[13px] text-neutral-500"
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard#decks"
                  onClick={() => setMenuOpen(false)}
                  className="py-1 text-[13px] text-neutral-500"
                >
                  Колоды
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md bg-[#2F3437] px-3.5 py-2 text-center text-[13px] font-medium text-white"
                >
                  Учёба →
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="py-1 text-left text-[13px] text-neutral-500"
                >
                  Выйти
                </button>
              </>
            )
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="py-1 text-[13px] text-neutral-500"
              >
                Войти
              </Link>
              <Link
                href="/register"
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-[#2F3437] px-3.5 py-2 text-center text-[13px] font-medium text-white"
              >
                Начать бесплатно →
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;
export { Header };
