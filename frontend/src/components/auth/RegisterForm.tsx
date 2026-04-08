"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { saveToken } from "@/lib/auth";
import { registerSchema, type RegisterInput } from "@/lib/validations/register";

type RegisterFormValues = Omit<RegisterInput, "deck_share_token">;

interface ServerFieldErrors {
  login?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("inviteCode")?.trim() ?? "";
  const loginHref = useMemo(() => {
    if (!inviteCode) return "/login";
    return `/login?next=${encodeURIComponent(`/decks/share/${inviteCode}`)}`;
  }, [inviteCode]);

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema.omit({ deck_share_token: true })),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      login: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login: data.login,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        ...(inviteCode ? { deck_share_token: inviteCode } : {}),
      }),
    });

    const resData = (await res.json().catch(() => ({}))) as {
      errors?: ServerFieldErrors;
      message?: string;
      access_token?: string;
      cloned_topic_unique_identifier?: number | null;
      deck_share_error?: string | null;
    };

    if (!res.ok) {
      const e = resData.errors;
      if (e?.login) setError("login", { message: e.login });
      if (e?.email) setError("email", { message: e.email });
      if (e?.password) setError("password", { message: e.password });
      if (e?.confirmPassword) {
        setError("confirmPassword", { message: e.confirmPassword });
      }
      setServerError(
        e?.general ?? resData.message ?? "Ошибка регистрации"
      );
      return;
    }

    if (resData.access_token) {
      saveToken(resData.access_token);
      if (
        typeof resData.cloned_topic_unique_identifier === "number" &&
        Number.isFinite(resData.cloned_topic_unique_identifier)
      ) {
        router.replace(
          `/dashboard?deckId=${resData.cloned_topic_unique_identifier}`
        );
      } else if (inviteCode) {
        router.replace(`/decks/share/${encodeURIComponent(inviteCode)}`);
      } else {
        router.replace("/");
      }
    } else if (resData.errors?.general) {
      setServerError(resData.errors.general);
    } else {
      router.push("/login");
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
        Создайте аккаунт
      </h1>
      <p className="mb-7 text-[13px] text-neutral-500">
        Уже есть аккаунт?{" "}
        <Link
          href={loginHref}
          className="text-neutral-900 hover:underline dark:text-neutral-100"
        >
          Войти →
        </Link>
      </p>

      {serverError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label="Логин"
          name="login"
          type="text"
          placeholder="valisa239"
          reg={register("login")}
          error={errors.login?.message}
        />

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
          placeholder="Минимум 8 символов"
          autoComplete="new-password"
          reg={register("password")}
          error={errors.password?.message}
        />

        <Field
          label="Повторите пароль"
          name="confirmPassword"
          type="password"
          placeholder="Повторите пароль"
          autoComplete="new-password"
          reg={register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 w-full rounded-md bg-[#2F3437] py-2.5 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-[0.85] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Создаём аккаунт..." : "Зарегистрироваться →"}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] text-neutral-400">
        Нажимая, вы соглашаетесь с{" "}
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
  name: keyof RegisterFormValues;
  type: string;
  placeholder: string;
  autoComplete?: string;
  reg: UseFormRegisterReturn<keyof RegisterFormValues>;
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
