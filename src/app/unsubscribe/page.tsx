import type { Metadata } from "next";
import AtlasShell from "@/components/atlas/AtlasShell";
import { waitForDb } from "@/lib/db";
import { findByUnsubscribeToken, isUnsubscribeTokenShape, maskEmail } from "@/lib/unsubscribe";
import UnsubscribeView, { type UnsubscribeState } from "./UnsubscribeView";

/**
 * /unsubscribe?t=… — отписка от рекламных писем по ссылке из подвала
 * письма. Серверная обёртка находит владельца токена (адрес показываем
 * не целиком); сама отписка — кнопкой (POST /api/unsubscribe): GET
 * ничего не меняет, почтовые сканеры открывают ссылки сами.
 *
 * Страница служебная — из поиска закрыта.
 */
export const metadata: Metadata = {
  title: "Отписка от рассылки",
  description: "Отписка от новостей и предложений Atlas Secure.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ t?: string | string[] }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.trim() : "";
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
    <AtlasShell sheetNo="26" sheetTitle="Отписка" headCta={{ href: "/", label: "На главную" }} footer="compact">
      <UnsubscribeView token={state === "invalid" ? "" : token} initial={state} email={email} />
    </AtlasShell>
  );
}
