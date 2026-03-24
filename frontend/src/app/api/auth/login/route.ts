import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loginSchema } from "@/lib/validations/login";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const flattened = z.flattenError(parsed.error);
      const errors: Record<string, string> = {};
      for (const [key, msgs] of Object.entries(flattened.fieldErrors ?? {})) {
        if (Array.isArray(msgs) && msgs[0]) errors[key] = msgs[0];
      }
      return NextResponse.json({ errors }, { status: 422 });
    }

    const { email, password } = parsed.data;
    const formData = new URLSearchParams();
    formData.append("username", email.trim());
    formData.append("password", password);

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      token_type?: string;
      detail?: string;
    };

    if (!res.ok) {
      return NextResponse.json(
        {
          errors: {
            general: data.detail ?? "Неверный email или пароль",
          },
        },
        { status: res.status === 422 ? 422 : 401 }
      );
    }

    return NextResponse.json({
      access_token: data.access_token,
      token_type: data.token_type ?? "bearer",
    });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json(
      {
        errors: { general: "Внутренняя ошибка сервера" },
      },
      { status: 500 }
    );
  }
}
