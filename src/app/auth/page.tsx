import type { Metadata } from "next";
import { cookies } from "next/headers";
import VShell from "@/components/vps/VShell";
import AuthPage from "../auth-page";
import { dict } from "@/i18n";
import { count } from "@/i18n/plural";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { getLocale } from "@/lib/locale-server";

/**
 * /auth — серверная обёртка входа: метаданные и оболочка корпуса VPS.
 * Тело со всеми шагами (почта + пароль, код письма, восстановление,
 * passkey) — клиентский AuthPage.
 *
 * Экран входа из поиска закрыт.
 */
export async function generateMetadata(): Promise<Metadata> {
  const m = dict(await getLocale()).auth.meta;
  return { title: m.title, description: m.description, robots: { index: false, follow: false } };
}

interface PageProps {
  searchParams: Promise<{ step?: string; ref?: string; next?: string }>;
}

/**
 * `?next=` — куда вернуть человека после входа (например, к оплате пакета
 * трафика). Только путь этого же сайта: начинается с «/», не «//» и не
 * «/\\», без схемы и управляющих символов. Всё остальное — в кабинет.
 * Та же проверка — в actions.ts (серверные действия входа).
 */
function safeNext(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.length > 512 || /[\u0000-\u001f\\]/.test(s)) return undefined;
  try {
    const u = new URL(s, "https://atlas.invalid");
    return u.origin === "https://atlas.invalid" ? u.pathname + u.search + u.hash : undefined;
  } catch {
    return undefined;
  }
}

export default async function Auth({ searchParams }: PageProps) {
  const [params, cookieStore, locale] = await Promise.all([searchParams, cookies(), getLocale()]);
  const pendingEmail = cookieStore.get("pending_email")?.value || "";
  const initialStep = params.step === "code" && pendingEmail ? "code" : "email";

  return (
    <VShell work>
      <AuthPage
        initialStep={initialStep}
        initialEmail={pendingEmail}
        referralCode={params.ref}
        next={safeNext(params.next)}
        locale={locale}
        t={dict(locale).auth}
        trial={count(locale, TRIAL_DAYS, dict(locale).units.day)}
      />
    </VShell>
  );
}
