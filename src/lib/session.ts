/**
 * Sessions — the cookie half. The ONLY way code reads "who is signed in".
 *
 *   getSessionUser(request?)  — route handlers pass the NextRequest;
 *                               server components / server actions call
 *                               it without arguments (next/headers).
 *   startSession(...)         — after a successful sign-in: DB row + token.
 *   setSessionCookie / clearSessionCookie — on a NextResponse.
 *
 * Cookie: `session` = random token (never the user id), httpOnly,
 * Secure in production, SameSite=Lax (the buyer comes back from
 * YooKassa by a top-level GET — Strict would drop the cookie there),
 * Path=/. Old cookies that carried a raw user id are not accepted:
 * they fail the token format check and the user signs in again.
 */

import type { NextResponse } from "next/server";
import type { UserRecord } from "./store";
import { rowToUser } from "./store";
import {
  createSession,
  findSessionWithUser,
  revokeSessionByToken,
  SESSION_TTL_MS,
  SessionRow,
  type AuthMethod,
} from "./session-store";

export const SESSION_COOKIE = "session";

export interface SessionUser {
  session: SessionRow;
  user: UserRecord;
  token: string;
  /** Expiry was extended in this request — re-issue the cookie. */
  touched: boolean;
}

type CookieSource = { get(name: string): { value: string } | undefined };
type RequestLike = { cookies: CookieSource };

export function sessionCookieOptions(maxAgeSeconds: number = Math.floor(SESSION_TTL_MS / 1000)) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

async function readToken(source?: RequestLike): Promise<string | undefined> {
  if (source) return source.cookies.get(SESSION_COOKIE)?.value;
  const { cookies } = await import("next/headers");
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/**
 * The signed-in user, or null. Never throws: a database hiccup reads as
 * "not signed in" (401), the same as before for a missing cookie.
 */
export async function getSessionUser(source?: RequestLike): Promise<SessionUser | null> {
  const token = await readToken(source);
  if (!token) return null;
  try {
    const found = await findSessionWithUser(token);
    if (!found) return null;
    return { session: found.session, user: rowToUser(found.userRow), token, touched: found.touched };
  } catch (err) {
    console.error("[SESSION] lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** A session cookie is present at all (cheap, no DB) — for "maybe signed in" UI hints only. */
export async function hasSessionCookie(source?: RequestLike): Promise<boolean> {
  return !!(await readToken(source));
}

export async function startSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null; authMethod?: AuthMethod } = {}
): Promise<{ token: string; session: SessionRow }> {
  return createSession(userId, meta);
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

/** Re-issue the cookie when the server extended the session (sliding window). */
export function refreshSessionCookie(response: NextResponse, su: SessionUser): void {
  if (su.touched) setSessionCookie(response, su.token);
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}

/** Server action / server component variant (next/headers cookie store). */
export async function setSessionCookieInStore(token: string): Promise<void> {
  const { cookies } = await import("next/headers");
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function endSession(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    await revokeSessionByToken(token);
  } catch (err) {
    console.error("[SESSION] revoke failed:", err instanceof Error ? err.message : err);
  }
}
