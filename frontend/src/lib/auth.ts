import { apiRequest } from "./api";

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

/**
 * Получение JWT-токена после успешной аутентификации.
 */
export async function login(
  email: string,
  password: string
): Promise<AuthTokenResponse> {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { detail?: string })?.detail ?? "Ошибка авторизации"
    );
  }

  return response.json() as Promise<AuthTokenResponse>;
}

/**
 * Сохранение токена в localStorage (для клиентского использования).
 */
export function saveToken(token: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("access_token", token);
  }
}

/**
 * Извлечение токена из localStorage.
 */
export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("access_token");
  }
  return null;
}
