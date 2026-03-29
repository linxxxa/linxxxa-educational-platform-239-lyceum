"use client";

import { usePathname, useSelectedLayoutSegments } from "next/navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";

interface PageWrapperProps {
  children: React.ReactNode;
}

/**
 * Общая оболочка: футер в потоке внизу страницы (не fixed).
 * При коротком контенте колонка min-h-screen + flex-1 на main прижимает футер к низу окна.
 */
export function PageWrapper({ children }: PageWrapperProps) {
  const pathname = usePathname() ?? "";
  const segments = useSelectedLayoutSegments();
  const isDashboard =
    segments?.[0] === "dashboard" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");

  return (
    <div className="flex min-h-screen w-full flex-col bg-neutral-100 dark:bg-neutral-950">
      {isDashboard ? (
        children
      ) : (
        <>
          <Header variant="default" />
          <main className="flex w-full flex-1 flex-col pt-20 pb-10">
            <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </>
      )}
      <Footer className="shrink-0" />
    </div>
  );
}
