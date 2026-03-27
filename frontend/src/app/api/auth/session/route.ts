import { NextResponse } from "next/server";

/** Завершение сессии на клиенте: токен удаляется в localStorage в handleLogout. */
export async function DELETE() {
  return NextResponse.json({ ok: true });
}
