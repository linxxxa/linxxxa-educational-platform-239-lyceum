"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveToken } from "@/lib/auth";

interface FormData {
  login: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  login?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    login: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = (await res.json().catch(() => ({}))) as {
      errors?: FormErrors;
      message?: string;
      access_token?: string;
    };

    if (!res.ok) {
      setErrors(data.errors ?? { general: data.message ?? "Ошибка регистрации" });
      setLoading(false);
      return;
    }

    if (data.access_token) {
      saveToken(data.access_token);
      router.push("/dashboard");
    } else if (data.errors?.general) {
      setErrors(data.errors);
    } else {
      router.push("/login");
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Шапка */}
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
          href="/login"
          className="text-neutral-900 hover:underline dark:text-neutral-100"
        >
          Войти →
        </Link>
      </p>

      {/* Общая ошибка */}
      {errors.general && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Логин"
          name="login"
          type="text"
          placeholder="valisa239"
          value={form.login}
          onChange={handleChange}
          error={errors.login}
        />

        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="you@239.ru"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />

        <Field
          label="Пароль"
          name="password"
          type="password"
          placeholder="Минимум 8 символов"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />

        <Field
          label="Повторите пароль"
          name="confirmPassword"
          type="password"
          placeholder="Повторите пароль"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-md bg-[#2F3437] py-2.5 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-[0.85] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Создаём аккаунт..." : "Зарегистрироваться →"}
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
  value,
  onChange,
  error,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={name}
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
        <span className="text-[11px] text-red-500">{error}</span>
      )}
    </div>
  );
}
