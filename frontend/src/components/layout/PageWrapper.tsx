"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";

interface PageWrapperProps {
  children: React.ReactNode;
}

/**
 * Общая оболочка страницы с Header и Footer.
 * На маршрутах /dashboard — хедер с ссылками Колоды / Учёба / Выйти.
 */
export function PageWrapper({ children }: PageWrapperProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard") ?? false;

  return (
    <div className="flex min-h-screen flex-col">
      <Header variant={isDashboard ? "dashboard" : "default"} />
      <div className="flex-1 pt-[calc(var(--app-header-h)+2rem)]">{children}</div>
      <Footer />
    </div>
  );
}
