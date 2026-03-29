"use client";

import { PageWrapper } from "@/components/layout";

/**
 * Оборачивает сегменты внутри контекста App Router, чтобы usePathname() и др.
 * в PageWrapper работали для /dashboard (хедер из app/dashboard/layout.tsx).
 */
export default function RootTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageWrapper>{children}</PageWrapper>;
}
