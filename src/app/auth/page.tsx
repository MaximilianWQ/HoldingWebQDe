import type { Metadata } from "next";
import { cookies } from "next/headers";
import AtlasShell from "@/components/atlas/AtlasShell";
import AuthPage from "../auth-page";

/**
 * /auth — серверная обёртка входа: метаданные и оболочка «Атлас-издания».
 * Тело со всеми шагами (почта → код → пароль, вход по паролю,
 * восстановление, passkey) — клиентский AuthPage.
 *
 * Экран входа из поиска закрыт. «Войти» в шапке не нужна — человек уже
 * на входе.
 */
export const metadata: Metadata = {
  title: "Вход",
  description: "Вход и регистрация в Atlas Secure по коду из письма или паролю.",
  robots: { index: false, follow: false },
};

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
  const params = await searchParams;
  const cookieStore = await cookies();
  const pendingEmail = cookieStore.get("pending_email")?.value || "";
  const initialStep = params.step === "code" && pendingEmail ? "code" : "email";

  return (
    <AtlasShell sheetNo="21" sheetTitle="Вход" headCta={null} footer="compact">
      <AuthPage
        initialStep={initialStep}
        initialEmail={pendingEmail}
        referralCode={params.ref}
        next={safeNext(params.next)}
      />
    </AtlasShell>
  );
}
