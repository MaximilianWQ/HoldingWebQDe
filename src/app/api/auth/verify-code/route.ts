import { NextRequest, NextResponse } from "next/server";
import { completeEmailSignIn } from "@/lib/auth-flow";
import { clientIpFrom } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { setSessionCookie, startSession } from "@/lib/session";

/**
 * JSON variant of the email sign-in. Delegates to the same shared
 * function as the server action (src/app/actions.ts), so there is one
 * trial path with one set of anti-abuse checks.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFrom(request.headers);
    // Code guesses per IP across all mailboxes (each code also burns after 5 misses).
    const limit = checkRateLimit(`verify:${ip || "unknown"}`, 30, 10 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком много попыток. Повторите через ${limit.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }

    const { email, code, referralCode, fingerprint } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ success: false, error: "Email и код обязательны" }, { status: 400 });
    }

    // Согласия — та же cookie, что пишет шаг почты (sendCodeAction).
    const consentParts = (request.cookies.get("pending_consent")?.value ?? "").split(",");
    const result = await completeEmailSignIn({
      email: String(email),
      code: String(code),
      referralCode: referralCode ? String(referralCode) : undefined,
      fingerprint: fingerprint ? String(fingerprint) : undefined,
      ip,
      consent: { privacy: consentParts.includes("privacy"), marketing: consentParts.includes("marketing") },
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    const user = result.user;

    const { token } = await startSession(user.id, { ip, userAgent: request.headers.get("user-agent") });
    const response = NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        subscriptionEnd: user.subscriptionEnd,
        // Legacy field names kept for old clients; both carry the panel link.
        vpnKey: user.subscriptionUrl,
        subscriptionUrl: user.subscriptionUrl,
        xrayUuid: null,
        isNew: user.isNew,
        trialGranted: user.trialGranted,
      },
    });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error("[AUTH] verify-code failed:", err);
    return NextResponse.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
