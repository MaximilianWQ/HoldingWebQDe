import { NextRequest, NextResponse } from "next/server";
import { generatePasskeyAuthentication, verifyPasskeyAuthentication } from "@/lib/passkey";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { setSessionCookie, startSession } from "@/lib/session";

const tooMany = (seconds: number) =>
  NextResponse.json({ success: false, error: `Слишком много попыток. Повторите через ${seconds} сек.` }, { status: 429 });

// GET — generate authentication options. Each call stores a challenge in
// memory for 5 minutes, so it is rate-limited per IP.
export async function GET(request: NextRequest) {
  const limit = checkRateLimit(`passkey-opt:${clientIpFrom(request.headers) || "unknown"}`, 30, 60_000);
  if (!limit.allowed) return tooMany(limit.retryAfterSeconds);
  try {
    const options = await generatePasskeyAuthentication();
    return NextResponse.json({ success: true, data: options });
  } catch (err) {
    console.error("[PASSKEY] Login options error:", err);
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST — verify authentication response
export async function POST(request: NextRequest) {
  const ip = clientIpFrom(request.headers);
  const limit = checkRateLimit(`passkey-login:${ip || "unknown"}`, 20, 60_000);
  if (!limit.allowed) return tooMany(limit.retryAfterSeconds);
  try {
    const body = await request.json();
    const result = await verifyPasskeyAuthentication(body);

    if (!result.verified || !result.userId) {
      return NextResponse.json({ success: false, error: "Ключ не распознан" }, { status: 401 });
    }

    const { token } = await startSession(result.userId, { ip, userAgent: request.headers.get("user-agent") , authMethod: "passkey" });
    const response = NextResponse.json({
      success: true,
      data: { userId: result.userId },
    });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error("[PASSKEY] Login verify error:", err);
    return NextResponse.json({ success: false, error: "Ошибка авторизации" }, { status: 400 });
  }
}
