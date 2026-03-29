import "katex/dist/katex.min.css";

import { Header } from "@/components/layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100 dark:bg-neutral-950">
      <Header variant="dashboard" />
      {/*
        h-14 = 3.5rem: отступ под фиксированный хедер.
        flex-1 — растягиваем область контента, чтобы футер из PageWrapper оказался внизу экрана при короткой странице.
      */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10 pt-[calc(3.5rem+1.125rem)] sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
