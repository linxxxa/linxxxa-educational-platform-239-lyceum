import type { NextRequest } from "next/server";

/**
 * Заголовки для запросов Next → FastAPI: передаём IP клиента, чтобы rate limit
 * (slowapi) считался по пользователю, а не по одному адресу сервера BFF.
 */
export function backendProxyHeaders(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    out["X-Forwarded-For"] = xff;
    return out;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    out["X-Forwarded-For"] = realIp.trim();
    return out;
  }
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) {
    out["X-Forwarded-For"] = cf.trim();
  }
  return out;
}
