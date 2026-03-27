import { Footer } from "./Footer";
import { Header } from "./Header";

interface PageWrapperProps {
  children: React.ReactNode;
}

/**
 * Общая оболочка страницы с Header и Footer.
 */
export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1 pt-[var(--app-header-h)]">{children}</div>
      <Footer />
    </div>
  );
}
