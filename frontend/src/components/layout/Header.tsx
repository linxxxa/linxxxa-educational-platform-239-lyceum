"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";
import { useAuthState } from "@/hooks/useAuthState";

interface HeaderProps {
  className?: string;
}

function Header({ className }: HeaderProps) {
  const router = useRouter();
  const authed = useAuthState();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  const handleLogout = () => {
    clearToken();
    setMenuOpen(false);
    router.push("/");
  };

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

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

  return (
    <header
      className={`
        fixed left-0 right-0 top-0 z-50
        transition-all duration-200
        ${scrolled
          ? "border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
          : "bg-transparent"}
        ${className ?? ""}
      `}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
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
          {authed ? (
            <>
              <Link
                href="/dashboard/topics"
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
                onClick={handleLogout}
                className="text-[13px] text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Выйти
              </button>
            </>
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
          className="flex flex-col gap-3 border-b border-neutral-200 bg-white px-5 pb-4 dark:border-neutral-800 dark:bg-neutral-950 md:hidden animate-menu-fade-in"
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
          {authed ? (
            <>
              <Link
                href="/dashboard/topics"
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
                onClick={handleLogout}
                className="py-1 text-left text-[13px] text-neutral-500"
              >
                Выйти
              </button>
            </>
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
