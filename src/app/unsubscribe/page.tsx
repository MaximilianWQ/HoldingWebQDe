import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import { waitForDb } from "@/lib/db";
import { findByUnsubscribeToken, isUnsubscribeTokenShape, maskEmail } from "@/lib/unsubscribe";
import UnsubscribeView, { type UnsubscribeState } from "./UnsubscribeView";
import { dict } from "@/i18n";
import { getLocale } from "@/lib/locale-server";

/**
 * /unsubscribe?t=… — отписка от рекламных писем по ссылке из подвала
 * письма. Серверная обёртка находит владельца токена (адрес показываем
 * не целиком); сама отписка — кнопкой (POST /api/unsubscribe): GET
 * ничего не меняет, почтовые сканеры открывают ссылки сами.
 *
 * Страница служебная — из поиска закрыта.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await getLocale()).unsubscribe;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  searchParams: Promise<{ t?: string | string[] }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const [{ t: tokenParam }, locale] = await Promise.all([searchParams, getLocale()]);
  const token = typeof tokenParam === "string" ? tokenParam.trim() : "";
  let state: UnsubscribeState = "invalid";
  let email: string | null = null;
  if (isUnsubscribeTokenShape(token)) {
    try {
      await waitForDb();
      const owner = await findByUnsubscribeToken(token);
      if (owner) {
        state = owner.optedOut ? "already" : "ready";
        email = maskEmail(owner.email);
      }
    } catch (err) {
      console.error("[UNSUBSCRIBE] lookup failed:", err instanceof Error ? err.message : err);
      state = "error";
    }
  }
  return (
    <VShell work>
      <UnsubscribeView
        token={state === "invalid" ? "" : token}
        initial={state}
        email={email}
        locale={locale}
        t={dict(locale).unsubscribe}
      />
    </VShell>
  );
}
