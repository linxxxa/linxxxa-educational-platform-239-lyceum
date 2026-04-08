"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import {
  isSafeInternalPath,
  PENDING_DECK_SHARE_TOKEN_KEY,
  saveToken,
} from "@/lib/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/login";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = (await res.json().catch(() => ({}))) as {
      errors?: FormErrors;
      message?: string;
      access_token?: string;
    };

    if (!res.ok) {
      setServerError(
        data.errors?.general ?? data.message ?? "Ошибка входа"
      );
      return;
    }

    if (data.access_token) {
      saveToken(data.access_token);
      const nextRaw = searchParams.get("next");
      let dest: string | null = null;
      if (isSafeInternalPath(nextRaw)) {
        dest = nextRaw;
      } else if (typeof window !== "undefined") {
        const pending = window.localStorage.getItem(
          PENDING_DECK_SHARE_TOKEN_KEY
        );
        if (pending?.trim()) {
          dest = `/decks/share/${encodeURIComponent(pending.trim())}`;
          window.localStorage.removeItem(PENDING_DECK_SHARE_TOKEN_KEY);
        }
      }
      router.replace(dest ?? "/");
    } else {
      setServerError("Не удалось получить токен");
    }
  });

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
      <Link href="/" className="mb-8 flex w-fit items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2F3437]">
          <span className="text-[10px] font-medium text-white">239</span>
        </div>
        <span className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
          EduLab
        </span>
      </Link>

      <h1 className="mb-1 text-[22px] font-medium text-neutral-900 dark:text-neutral-100">
        Войдите в аккаунт
      </h1>
      <p className="mb-7 text-[13px] text-neutral-500">
        Нет аккаунта?{" "}
        <Link
          href="/register"
          className="text-neutral-900 hover:underline dark:text-neutral-100"
        >
          Зарегистрироваться →
        </Link>
      </p>

      {serverError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="you@239.ru"
          autoComplete="email"
          reg={register("email")}
          error={errors.email?.message}
        />

        <Field
          label="Пароль"
          name="password"
          type="password"
          placeholder="Ваш пароль"
          autoComplete="current-password"
          reg={register("password")}
          error={errors.password?.message}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 w-full rounded-md bg-[#2F3437] py-2.5 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-[0.85] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Входим…" : "Войти →"}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] text-neutral-400">
        Нажимая «Войти», вы соглашаетесь с{" "}
        <Link href="/terms" className="underline">
          условиями использования
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  autoComplete,
  reg,
  error,
}: {
  label: string;
  name: keyof LoginInput;
  type: string;
  placeholder: string;
  autoComplete?: string;
  reg: UseFormRegisterReturn<keyof LoginInput>;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={String(name)}
        className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300"
      >
        {label}
      </label>
      <input
        id={String(name)}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete ?? String(name)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${String(name)}-err` : undefined}
        {...reg}
        className={`
          h-9 w-full rounded-md border px-3 text-[13px] outline-none transition-colors duration-150
          placeholder:text-neutral-400
          dark:bg-neutral-900
          focus:border-neutral-400 dark:focus:border-neutral-500
          ${
            error
              ? "border-red-400 dark:border-red-600"
              : "border-neutral-200 dark:border-neutral-700"
          }
        `}
      />
      {error && (
        <span id={`${String(name)}-err`} className="text-[11px] text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
