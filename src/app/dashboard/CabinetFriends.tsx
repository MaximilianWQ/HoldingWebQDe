"use client";

import { useState } from "react";
import Icon from "@/components/pixel/Icon";
import { useToast } from "@/components/vps/Toast";
import { LOYALTY_TIERS, tierName } from "@/lib/loyalty";
import { fill, type Dict } from "@/i18n";
import type { Locale } from "@/lib/locale";

/**
 * Профиль · приглашения. Расчёт шкалы — из прежней ReferralSection
 * один в один, стили — общий слой кабинета (vc-rail, vc-tiers,
 * vc-stats).
 *
 * Ступени берутся из `src/lib/loyalty.ts` — там же, откуда их берёт
 * оферта и витрина; своей копии процентов здесь нет. Название ступени
 * тоже оттуда (`tierName`), а не из ответа API: ответ приходит
 * по-русски, и на английской странице он был бы единственным русским
 * словом на экране.
 */
const TIERS = LOYALTY_TIERS;

export default function CabinetFriends({
  locale,
  t,
  referralCode,
  cashbackPercent,
  referrals,
  paidReferrals,
}: {
  locale: Locale;
  t: Dict["cabinet"]["friends"];
  referralCode: string;
  cashbackPercent: number;
  referrals: number;
  paidReferrals: number;
}) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}?ref=${referralCode}` : "";

  const idx = Math.max(0, TIERS.findIndex((t) => t.percent === cashbackPercent));
  const current = TIERS[idx];
  const next = TIERS[idx + 1];
  const toNext = next ? Math.max(0, next.from - paidReferrals) : 0;
  const seg = next ? Math.min(1, Math.max(0, (paidReferrals - current.from) / (next.from - current.from))) : 1;
  // Заливка шкалы 0…1. Имя не `fill` — так зовётся подстановка в строку.
  const railFill = next ? (idx + seg) / (TIERS.length - 1) : 1;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast(t.copiedToast);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: "Atlas Secure VPS",
            text: fill(t.shareText, { percent: cashbackPercent }),
            url: shareUrl,
          });
        } catch {
          copy(shareUrl);
        }
      } else {
        copy(shareUrl);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <section id="vc-friends" aria-labelledby="vc-fr-h">
      <div className="vc-kblock-head">
        <h3 id="vc-fr-h">{t.title}</h3>
        <span className="v-badge">{tierName(current, locale)}</span>
      </div>

      <p className="vc-value">
        {cashbackPercent}%<small>{t.cashbackCap}</small>
      </p>

      <div className="vc-rail" aria-hidden>
        <i className="vc-rail-fill" style={{ "--p": railFill } as React.CSSProperties} />
        {TIERS.map((x, k) => (
          <span
            key={x.tier}
            className="vc-rail-stop"
            style={{ left: `${(k / (TIERS.length - 1)) * 100}%` }}
            data-on={k <= idx ? "" : undefined}
          />
        ))}
      </div>
      <div className="vc-tiers">
        {TIERS.map((x, k) => (
          <span key={x.tier} className="vc-tier" data-on={k <= idx ? "" : undefined}>
            <b>{x.percent}%</b>
            {tierName(x, locale)}
          </span>
        ))}
      </div>

      <div className="vc-stats v-stagger">
        <div className="vc-stat v-lift">
          <span>{t.statInvited}</span>
          <b>{referrals}</b>
        </div>
        <div className="vc-stat v-lift">
          <span>{t.statPaid}</span>
          <b>{paidReferrals}</b>
        </div>
        <div className="vc-stat v-lift">
          <span>{next ? fill(t.statTo, { percent: next.percent }) : t.statLevel}</span>
          <b>{next ? toNext : t.statMax}</b>
        </div>
      </div>

      <div className="vc-actions">
        <button type="button" onClick={handleShare} disabled={sharing} className="v-btn v-btn-primary v-btn-sm">
          <Icon name="share" size={16} />
          {t.share}
        </button>
        <button type="button" onClick={() => copy(shareUrl)} className="v-btn v-btn-soft v-btn-sm">
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? t.copied : t.copyLink}
        </button>
      </div>
    </section>
  );
}
