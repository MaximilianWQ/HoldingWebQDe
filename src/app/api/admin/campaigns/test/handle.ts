import { sendTestEmail, type CampaignInput } from "@/lib/campaigns";
import { resendMailer } from "@/lib/campaign-mailer";
import { getUserById, createAuditLog } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";
import { defaultTestAddress, errorText, fail, ok, repo, type Admin } from "../shared";

export const TEST_PER_HOUR = 10;

/** Общая часть теста для черновика и для сохранённой кампании. */
export async function handleTestSend(admin: Admin, input: CampaignInput, rawTo: unknown) {
  const to = (typeof rawTo === "string" && rawTo.trim() ? rawTo.trim() : defaultTestAddress(admin)).toLowerCase();
  if (!to) return fail(400, "Укажите адрес для теста");
  const rl = checkRateLimit(`campaign-test:${admin.userId}`, TEST_PER_HOUR, 60 * 60 * 1000);
  if (!rl.allowed) return fail(429, `Тестов не больше ${TEST_PER_HOUR} в час. Повторите через ${Math.ceil(rl.retryAfterSeconds / 60)} мин.`);
  try {
    const me = await getUserById(admin.userId);
    const fallback = me ? { email: me.email, subscriptionEnd: new Date(me.subscriptionEnd), plan: me.subscriptionPlan } : null;
    const r = await sendTestEmail(repo, resendMailer(), input, to, fallback);
    if (!r.ok) return fail(r.status, r.error);
    await createAuditLog("admin.campaign_test", `Тест «${input.subject.slice(0, 80)}» → ${to}`, admin.userId, admin.email ?? undefined);
    return ok(r.data);
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] test:", errorText(err));
    return fail(500, "Не удалось отправить тест");
  }
}
