import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BOT_API_KEY = process.env.BOT_API_KEY || "";

export function verifyBotApiKey(request: NextRequest): boolean {
  if (!BOT_API_KEY) return false;
  const key = request.headers.get("X-Bot-Api-Key");
  if (!key) return false;

  // Timing-safe comparison to prevent character-by-character guessing
  try {
    // Сравниваем хеши, а не сами строки (аудит 19.09.2026): ветка
    // «длины не совпали» возвращалась заметно быстрее и выдавала
    // длину ключа. Хеш всегда 32 байта, и сравнение честно
    // постоянное по времени при любом вводе.
    const a = crypto.createHash("sha256").update(key, "utf-8").digest();
    const b = crypto.createHash("sha256").update(BOT_API_KEY, "utf-8").digest();
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}
