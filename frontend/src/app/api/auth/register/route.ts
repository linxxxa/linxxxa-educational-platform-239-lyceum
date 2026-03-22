import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerSchema } from "@/lib/validations/register";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Маппинг полей формы на поля backend */
function mapToBackend(body: { login: string; email: string; password: string }) {
  return {
    user_full_display_name: body.login.trim(),
    user_email_address: body.email.toLowerCase().trim(),
    plain_text_password_for_hashing: body.password,
  };
}

/** Извлечь текстовое сообщение из ответа backend */
function extractMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && detail !== null && "detail" in detail) {
    return String((detail as { detail: unknown }).detail);
  }
  return "Ошибка регистрации";
}

/** Преобразование ошибок FastAPI/Pydantic в формат формы */
function mapBackendErrors(
  status: number,
  detail: unknown
): Record<string, string> {
  const msg = extractMessage(detail);

  if (status === 409 || status === 400) {
    if (msg?.toLowerCase().includes("email")) {
      return { email: "Этот email уже зарегистрирован" };
    }
    return { general: msg || "Ошибка регистрации" };
  }

  if (status === 422 && Array.isArray(detail)) {
    const errors: Record<string, string> = {};
    for (const item of detail as Array<{ loc?: string[]; msg?: string }>) {
      const field = item.loc?.filter((s) => s !== "body")[0];
      if (field && item.msg) {
        const key =
          field === "user_full_display_name"
            ? "login"
            : field === "user_email_address"
              ? "email"
              : field === "plain_text_password_for_hashing"
                ? "password"
                : field;
        errors[key] = item.msg;
      }
    }
    return Object.keys(errors).length ? errors : { general: msg };
  }

  if (status >= 500) {
    return { general: msg || "Ошибка сервера. Попробуйте позже." };
  }

  return { general: msg || "Ошибка регистрации" };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const flattened = z.flattenError(parsed.error);
      const errors: Record<string, string> = {};
      for (const [key, msgs] of Object.entries(flattened.fieldErrors ?? {})) {
        if (Array.isArray(msgs) && msgs[0]) errors[key] = msgs[0];
      }
      return NextResponse.json({ errors }, { status: 422 });
    }

    const { login, email, password } = parsed.data;
    const payload = mapToBackend({ login, email, password });

    const registerRes = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const registerData = (await registerRes.json().catch(() => ({}))) as {
      detail?: unknown;
    };

    if (!registerRes.ok) {
      const errors = mapBackendErrors(
        registerRes.status,
        (registerData as { detail?: unknown }).detail ?? registerData
      );
      const status = registerRes.status === 400 ? 409 : registerRes.status;
      return NextResponse.json({ errors }, { status });
    }

    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: email.toLowerCase().trim(),
        password,
      }),
    });

    const loginData = (await loginRes.json().catch(() => ({}))) as {
      access_token?: string;
      detail?: string;
    };

    if (!loginRes.ok) {
      return NextResponse.json(
        {
          message: "Аккаунт создан, но не удалось выполнить вход",
          errors: { general: loginData.detail ?? "Войдите вручную" },
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        message: "Аккаунт создан",
        access_token: loginData.access_token,
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError =
      /fetch|ECONNREFUSED|ENOTFOUND|network/i.test(msg);
    const message = isNetworkError
      ? "Не удалось подключиться к backend. Запущен ли сервер на порту 8000?"
      : "Внутренняя ошибка сервера";
    console.error("[register]", err);
    return NextResponse.json(
      { message, errors: { general: message } },
      { status: 500 }
    );
  }
}
