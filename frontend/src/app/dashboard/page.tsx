import { Suspense } from "react";
import DashboardPage from "@/components/dashboard/DashboardPage";

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-neutral-500 dark:text-neutral-400">
          Загрузка…
        </div>
      }
    >
      <DashboardPage />
    </Suspense>
  );
}
