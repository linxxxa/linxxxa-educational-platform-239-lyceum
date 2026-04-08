import { Suspense } from "react";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <Suspense fallback={<div className="text-sm text-neutral-500">…</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
