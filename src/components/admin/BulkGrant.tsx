"use client";

import { useState } from "react";
import { Spin, useAdminConfirm, useAdminToast } from "@/app/admin/AdminConfirm";
import { getJson, num, type UserFilter } from "@/app/admin/admin-shared";

/**
 * Массовая выдача подписки из раздела «Пользователи».
 *
 * Полоса появляется, когда включён режим выбора. Получателей два вида,
 * и разница между ними важна:
 *   · отмеченные галочками — ровно эти люди, список фиксируется сразу;
 *   · «все под фильтром» — те, кого сервер найдёт по тому же фильтру и
 *     поиску в момент запуска. Здесь их может быть больше, чем видно на
 *     экране: список подгружается страницами.
 *
 * Действие уходит одним запросом и дальше живёт как рассылка: начисление
 * идёт сразу, письма — пачками под суточной квотой Resend. Поэтому здесь
 * нет ни прогресса, ни отмены: и то и другое лежит в «Сервис» →
 * «Рассылки и начисления», и полоса честно говорит, куда смотреть.
 */

const PLANS: Array<{ key: "trial" | "basic" | "plus"; label: string }> = [
  { key: "trial", label: "Пробный" },
  { key: "basic", label: "Basic" },
  { key: "plus", label: "Plus" },
];

const DAY_PRESETS = [3, 7, 14, 30, 90];

export interface BulkScope {
  /** Отмеченные галочками. */
  ids: string[];
  /** Текущий фильтр и поиск — для варианта «все под фильтром». */
  filter: UserFilter;
  q: string;
  /** Сколько человек всего под этим фильтром (может быть больше загруженных). */
  total: number;
  filterLabel: string;
}

interface Props {
  scope: BulkScope;
  onDone: () => void;
  onClose: () => void;
  onSelectAllLoaded: () => void;
  onClearIds: () => void;
  loadedCount: number;
}

type Target = "ids" | "filter";

export default function BulkGrant({ scope, onDone, onClose, onSelectAllLoaded, onClearIds, loadedCount }: Props) {
  const confirm = useAdminConfirm();
  const toast = useAdminToast();
  const [target, setTarget] = useState<Target>("ids");
  const [plan, setPlan] = useState<"trial" | "basic" | "plus">("basic");
  const [days, setDays] = useState("7");
  const [gb, setGb] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = target === "ids" ? scope.ids.length : scope.total;
  const daysN = Number(days);
  const gbN = gb.trim() === "" ? null : Number(gb);
  const valid =
    count > 0 &&
    Number.isInteger(daysN) &&
    daysN >= 1 &&
    daysN <= 400 &&
    (gbN === null || (Number.isInteger(gbN) && gbN >= 1));

  const who =
    target === "ids"
      ? `${num(scope.ids.length)} выбранным`
      : `всем под фильтром «${scope.filterLabel}»${scope.q ? ` и поиском «${scope.q}»` : ""} — это ${num(scope.total)} чел.`;

  const submit = async () => {
    if (!valid || busy) return;
    const label = `${daysN} дн. ${PLANS.find((p) => p.key === plan)?.label}${gbN ? ` и ${gbN} ГБ обхода` : ""}`;
    const okToGo = await confirm({
      title: `Выдать ${label}?`,
      text:
        `Получат ${who}\n\n` +
        "Дни начислятся сразу, письма о подарке уйдут пачками под суточной квотой Resend — " +
        "той же, из которой уходят коды входа. Отменить начисление нельзя: дни придётся снимать вручную.",
      confirmLabel: "Выдать",
      tone: "danger",
    });
    if (!okToGo) return;

    setBusy(true);
    setError(null);
    const selection =
      target === "ids" ? { type: "ids", ids: scope.ids } : { type: "filter", filter: scope.filter, q: scope.q || null };
    const r = await getJson<{ counts: { total: number; queued: number }; id: string }>("/api/admin/users/bulk-grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selection, plan, days: daysN, trafficGb: gbN }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast(`Выдаём ${label}: получателей ${num(r.data.counts.total)}. Ход — в «Сервис» → «Рассылки и начисления».`, "ok");
    onClearIds();
    onClose();
    onDone();
  };

  return (
    <div className="adm-bulk" role="group" aria-label="Массовая выдача подписки">
      <div className="adm-bulk-who">
        <button
          type="button"
          className="adm-chip"
          aria-pressed={target === "ids"}
          onClick={() => setTarget("ids")}
        >
          Выбранные <span className="adm-chip-n a-num">{num(scope.ids.length)}</span>
        </button>
        <button
          type="button"
          className="adm-chip"
          aria-pressed={target === "filter"}
          onClick={() => setTarget("filter")}
        >
          Все под фильтром <span className="adm-chip-n a-num">{num(scope.total)}</span>
        </button>
        {target === "ids" && (
          <>
            <button type="button" className="adm-bulk-link" onClick={onSelectAllLoaded}>
              Отметить загруженные ({num(loadedCount)})
            </button>
            {scope.ids.length > 0 && (
              <button type="button" className="adm-bulk-link" onClick={onClearIds}>
                Снять отметки
              </button>
            )}
          </>
        )}
      </div>

      <div className="adm-bulk-form">
        <label className="adm-bulk-f">
          <span>Тариф</span>
          <select className="adm-input adm-select" value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
            {PLANS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="adm-bulk-f">
          <span>Дней</span>
          <input
            className="adm-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={400}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
        <label className="adm-bulk-f">
          <span>ГБ обхода <i>не обязательно</i></span>
          <input
            className="adm-input"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="—"
            value={gb}
            onChange={(e) => setGb(e.target.value)}
          />
        </label>
        <div className="adm-bulk-go">
          <button type="button" className="a-btn" onClick={submit} disabled={!valid || busy}>
            {busy ? <><Spin />Запускаем…</> : <>Выдать {num(count)} чел.</>}
          </button>
          <button type="button" className="a-btn ak-btn-soft" onClick={onClose} disabled={busy}>
            Отмена
          </button>
        </div>
      </div>

      <div className="adm-bulk-presets" role="group" aria-label="Готовые сроки">
        {DAY_PRESETS.map((d) => (
          <button key={d} type="button" className="adm-chip" aria-pressed={daysN === d} onClick={() => setDays(String(d))}>
            {d} дн.
          </button>
        ))}
      </div>

      <p className="adm-bulk-note">
        Письмо — тот же макет подарка, что при выдаче одному человеку. Аккаунтам бота
        (<span className="a-num">telegram_…@tg.</span>) письма не уходят — им приходит уведомление в кабинете.
        Ход выдачи и остаток суточной квоты писем — в разделе «Сервис».
      </p>

      {error && <p className="adm-bulk-err" role="alert">{error}</p>}
    </div>
  );
}
