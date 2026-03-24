import { getToken } from "@/lib/auth";

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeader(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Прямой вызов backend (если нужен обход Next proxy). */
export async function postSessionStartBackend(): Promise<Response> {
  return fetch(`${apiBase()}/study/session-start`, {
    method: "POST",
    headers: { ...authHeader() },
  });
}
