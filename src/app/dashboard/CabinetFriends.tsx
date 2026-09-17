"use client";

import { useState } from "react";
import Icon from "@/components/pixel/Icon";
import { useToast } from "@/components/vps/Toast";

/**
 * Профиль · приглашения. Уровни кешбэка и расчёт шкалы — из прежней
 * ReferralSection один в один, стили — общий слой кабинета (vc-rail,
 * vc-tiers, vc-stats).
 */
const TIERS = [
  { name: "Стартовый", percent: 10, threshold: 0 },
  { name: "Продвинутый", percent: 25, threshold: 25 },
  { name: "Партнёр", percent: 45, threshold: 50 },
];

export default function CabinetFriends({
  referralCode,
  cashbackPercent,
  loyaltyTier,
  referrals,
  paidReferrals,
}: {
  referralCode: string;
  cashbackPercent: number;
  loyaltyTier: string;
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
  const toNext = next ? Math.max(0, next.threshold - paidReferrals) : 0;
  const seg = next ? Math.min(1, Math.max(0, (paidReferrals - current.threshold) / (next.threshold - current.threshold))) : 1;
  const fill = next ? (idx + seg) / (TIERS.length - 1) : 1;

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
    toast("Ссылка скопирована");
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
            text: `Присоединяйся к Atlas Secure VPS — кешбэк ${cashbackPercent}% за приглашения.`,
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
        <h3 id="vc-fr-h">Приглашайте друзей</h3>
        <span className="v-badge">{loyaltyTier}</span>
      </div>

      <p className="vc-value">
        {cashbackPercent}%<small>кешбэк с каждой оплаты друга</small>
      </p>

      <div className="vc-rail" aria-hidden>
        <i className="vc-rail-fill" style={{ "--p": fill } as React.CSSProperties} />
        {TIERS.map((t, k) => (
          <span
            key={t.name}
            className="vc-rail-stop"
            style={{ left: `${(k / (TIERS.length - 1)) * 100}%` }}
            data-on={k <= idx ? "" : undefined}
          />
        ))}
      </div>
      <div className="vc-tiers">
        {TIERS.map((t, k) => (
          <span key={t.name} className="vc-tier" data-on={k <= idx ? "" : undefined}>
            <b>{t.percent}%</b>
            {t.name}
          </span>
        ))}
      </div>

      <div className="vc-stats">
        <div className="vc-stat">
          <span>Пригласили</span>
          <b>{referrals}</b>
        </div>
        <div className="vc-stat">
          <span>Оплатили</span>
          <b>{paidReferrals}</b>
        </div>
        <div className="vc-stat">
          <span>{next ? `До ${next.percent}%` : "Уровень"}</span>
          <b>{next ? toNext : "макс."}</b>
        </div>
      </div>

      <div className="vc-actions">
        <button type="button" onClick={handleShare} disabled={sharing} className="v-btn v-btn-primary v-btn-sm">
          <Icon name="share" size={16} />
          Поделиться
        </button>
        <button type="button" onClick={() => copy(shareUrl)} className="v-btn v-btn-soft v-btn-sm">
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? "Скопировано" : "Скопировать ссылку"}
        </button>
      </div>
    </section>
  );
}
