"use client";

import { useState, useRef, useEffect, useActionState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import Icon from "@/components/pixel/Icon";
import { useToast } from "@/components/vps/Toast";
import { BRAND } from "@/components/vps/links";
import { sendCodeAction, verifyCodeAction, type SendCodeState, type VerifyCodeState } from "./actions";
import type { Dict } from "@/i18n";
import { fill } from "@/lib/text/fill";
import { localeHref, type Locale } from "@/lib/locale";
import "./auth/auth-v.css";

/** Вызов server action, который при отказе запроса возвращает ошибку
 *  в состояние формы, а не бросает её в границу ошибок страницы. */
async function guardAction<S extends { success: boolean; error?: string }>(
  run: () => Promise<S>,
  offline: string,
): Promise<S> {
  try {
    return await run();
  } catch (e) {
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e; // redirect / notFound
    return { success: false, error: offline } as S;
  }
}

/**
 * Вход — простой экран в стиле Apple: одна узкая карточка по центру,
 * крупный заголовок, поля, синяя кнопка «Войти». Почта и пароль видны
 * сразу; код из письма и Passkey — второй путь под разделителем.
 *
 * Логика прежнего экрана перенесена без изменений: server actions
 * sendCodeAction / verifyCodeAction, запросы /api/auth/*, passkey,
 * реферальный код, отпечаток устройства, редиректы. Шаги «почта» и
 * «пароль» прежнего мастера объединены в один экран `start` — сервер
 * как раньше сам решает, есть ли у почты пароль (`hasPassword`), но
 * теперь это просто подсказка под тем же полем, без перехода на другой
 * шаг. Код по-прежнему набирается в одно скрытое поле поверх шести
 * клеток — так iOS/Android подставляют код из письма.
 */

type AuthStep =
  | "start"
  | "code"
  | "set-password"
  | "reset-email"
  | "reset-code"
  | "reset-password"
  | "reset-success";

interface AuthPageProps {
  /** Язык страницы и её текст — от серверной обёртки. */
  locale: Locale;
  t: Dict["auth"];
  /** Срок пробного периода словами на языке страницы: «3 дня» / «3 days». */
  trial: string;
  initialStep: "email" | "code";
  initialEmail: string;
  referralCode?: string;
  /** Куда вернуть после входа (проверенный путь сайта, auth/page.tsx); по умолчанию — кабинет. */
  next?: string;
}

function generateDeviceFingerprint(): string {
  const parts: string[] = [];
  parts.push(navigator.userAgent);
  parts.push(navigator.language);
  parts.push(String(screen.width) + "x" + String(screen.height));
  parts.push(String(screen.colorDepth));
  parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  parts.push(String(navigator.hardwareConcurrency || 0));
  parts.push(String((navigator as unknown as { deviceMemory?: number }).deviceMemory || 0));
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("Atlas", 2, 2);
      parts.push(canvas.toDataURL().slice(-50));
    }
  } catch { /* ignore */ }
  const str = parts.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/* ─── Мелкие части формы ─────────────────────────────────────────── */

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="av-back">
      <Icon name="arrow-right" size={15} />
      {label}
    </button>
  );
}

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="av-err" role="alert">{text}</p>
  );
}

function Busy({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="av-spin" aria-hidden />
      {children}
    </>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  autoFocus,
  invalid,
  describedBy,
  inputRef,
  hint,
  labelExtra,
  t,
}: {
  id: string;
  label: string;
  /** Раздел словаря `auth`: подписи кнопки «показать/скрыть». */
  t: Dict["auth"];
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  hint?: string;
  labelExtra?: ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const described = [hintId, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="v-field">
      <div className="av-row">
        <label className="v-label" htmlFor={id}>{label}</label>
        {labelExtra}
      </div>
      <div className="av-pw">
        <input
          ref={inputRef}
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize="none"
          spellCheck={false}
          className="v-input"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={described}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="av-toggle"
          aria-pressed={show}
          aria-controls={id}
          aria-label={show ? t.hidePassword : t.showPassword}
        >
          {show ? t.hide : t.show}
        </button>
      </div>
      {hint && <p id={hintId} className="av-hint">{hint}</p>}
    </div>
  );
}

/**
 * Поле кода: одно настоящее поле поверх шести нарисованных клеток.
 * Поле прозрачное и занимает всю ширину ряда — куда бы ни попал палец,
 * фокус попадает в него. Клетки показывают набранные цифры и курсор.
 */
function CodeField({
  id,
  name,
  value,
  onChange,
  invalid,
  describedBy,
  inputRef,
  label,
}: {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  invalid?: boolean;
  describedBy?: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const active = Math.min(value.length, 5);
  return (
    <div className="v-field">
      <label className="v-label" htmlFor={id}>{label}</label>
      <div className="av-code" data-invalid={invalid ? "" : undefined}>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          enterKeyHint="done"
          value={value}
          onChange={onChange}
          onFocus={(e) => e.target.select()}
          className="av-code-input"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          required
        />
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="av-cell"
            aria-hidden
            data-filled={value[i] ? "" : undefined}
            data-active={i === active ? "" : undefined}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AuthPage({ initialStep, initialEmail, referralCode, next, locale, t, trial }: AuthPageProps) {
  const to = (href: string) => localeHref(href, locale);
  const router = useRouter();
  const toast = useToast();
  const after = next || "/dashboard";
  const [step, setStep] = useState<AuthStep>(initialStep === "code" ? "code" : "start");
  const [email, setEmail] = useState(initialEmail);
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [countdown, setCountdown] = useState(initialStep === "code" ? 60 : 0);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeFormRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");

  /** Состояние входа через Telegram: ожидание подтверждения в боте. */
  type TgLogin =
    | { state: "idle" }
    | { state: "busy" }
    | { state: "waiting"; code: string; botUrl: string | null; startParam: string }
    | { state: "done" }
    | { state: "error"; error: string };
  const [tgLogin, setTgLogin] = useState<TgLogin>({ state: "idle" });

  const [resendLoading, setResendLoading] = useState(false);

  // Пароль — то же поле, что и на прежнем шаге «Вход по паролю»: живёт
  // на общем экране рядом с почтой.
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setPasswordError, setSetPasswordError] = useState("");
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const newPwRef = useRef<HTMLInputElement>(null);
  const confirmPwRef = useRef<HTMLInputElement>(null);

  const [resetEmail, setResetEmail] = useState("");
  const [resetCodeInput, setResetCodeInput] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword1, setResetPassword1] = useState("");
  const [resetPassword2, setResetPassword2] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);
  const [showResetPassword1, setShowResetPassword1] = useState(false);
  const [showResetPassword2, setShowResetPassword2] = useState(false);
  const resetCodeRef = useRef<HTMLInputElement>(null);
  const resetPw1Ref = useRef<HTMLInputElement>(null);
  const resetPw2Ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDeviceFingerprint(generateDeviceFingerprint());
  }, []);

  // ─── Passkey Login ──────────────────────────────────────────
  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setPasskeyError("");
    try {
      const optRes = await fetch("/api/auth/passkey/login");
      const optData = await optRes.json();
      if (!optData.success) throw new Error(optData.error);

      const credential = await startAuthentication({ optionsJSON: optData.data });

      const verRes = await fetch("/api/auth/passkey/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const verData = await verRes.json();

      if (verData.success) {
        router.push(after);
      } else {
        setPasskeyError(verData.error || t.errors.keyNotRecognised);
      }
    } catch (err) {
      if ((err as Error).name === "NotAllowedError") {
        setPasskeyError("");
      } else {
        setPasskeyError(t.errors.passkeyFailed);
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  /**
   * Вход через Telegram (20.09.2026; прежде кнопка показывала «в
   * разработке», хотя серверная часть была готова).
   *
   * Порядок такой, и он не случаен:
   *   1. сайт создаёт одноразовый ключ и привязывает его К ЭТОМУ
   *      браузеру — секрет уходит в httpOnly cookie;
   *   2. открывается бот с этим ключом; сайт показывает четыре цифры;
   *   3. бот показывает те же четыре цифры и спрашивает подтверждение —
   *      так человек видит, что подтверждает ИМЕННО свой вход, а не
   *      чей-то чужой, подсунутый ссылкой;
   *   4. страница опрашивает сайт и получает сессию — только в том
   *      браузере, где лежит секрет, и только один раз.
   *
   * Окно бота открывается СРАЗУ по нажатию, до запроса: Safari на
   * iPhone блокирует `window.open`, вызванный после ожидания ответа.
   * Поэтому на телефоне уходим по `location.href`, а на широком экране
   * открываем пустую вкладку заранее и подставляем в неё адрес.
   */
  const tgPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (tgPoll.current) clearInterval(tgPoll.current); }, []);

  const handleTelegramLogin = async () => {
    if (tgLogin.state === "busy" || tgLogin.state === "waiting") return;
    const mobile = window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const win = mobile ? null : window.open("", "_blank");
    if (win) win.opener = null;
    setTgLogin({ state: "busy" });
    try {
      const res = await fetch("/api/auth/telegram-start", { method: "POST" });
      const j = await res.json();
      if (!j.success) {
        win?.close();
        setTgLogin({ state: "error", error: j.error || t.errors.tgStart });
        return;
      }
      const { nonce, botUrl, confirmCode, startParam } = j.data as {
        nonce: string; botUrl: string | null; confirmCode: string; startParam: string;
      };
      if (botUrl && mobile) window.location.href = botUrl;
      else if (botUrl && win) win.location.href = botUrl;
      else win?.close();

      setTgLogin({ state: "waiting", code: confirmCode, botUrl, startParam });

      const until = Date.now() + 5 * 60_000;
      if (tgPoll.current) clearInterval(tgPoll.current);
      tgPoll.current = setInterval(async () => {
        if (Date.now() > until) {
          if (tgPoll.current) clearInterval(tgPoll.current);
          setTgLogin({ state: "error", error: t.errors.tgTimeout });
          return;
        }
        try {
          const r = await fetch(`/api/auth/telegram-check?nonce=${encodeURIComponent(nonce)}`);
          const d = await r.json();
          if (d.success) {
            if (tgPoll.current) clearInterval(tgPoll.current);
            setTgLogin({ state: "done" });
            router.replace(after);
            router.refresh();
          } else if (d.status && d.status !== "pending") {
            if (tgPoll.current) clearInterval(tgPoll.current);
            setTgLogin({ state: "error", error: t.errors.tgStale });
          }
        } catch {
          /* сеть моргнула — следующая попытка через две секунды */
        }
      }, 2000);
    } catch {
      win?.close();
      setTgLogin({ state: "error", error: t.errors.tgNetwork });
    }
  };

  // ─── Server Actions ───────────────────────────────────────────
  // Отказ самого запроса (сервер отклонил действие, сеть, устаревшая
  // вкладка после выкладки) не должен ронять страницу в «This page
  // couldn't load» — показываем ошибку у поля. Переход (redirect)
  // пробрасываем дальше: его обрабатывает роутер Next.
  const [sendState, sendAction, sendPending] = useActionState(
    (prev: SendCodeState, fd: FormData) => guardAction(() => sendCodeAction(prev, fd), t.errors.noServer),
    { success: false }
  );

  const [verifyState, verifyAction, verifyPending] = useActionState(
    (prev: VerifyCodeState, fd: FormData) => guardAction(() => verifyCodeAction(prev, fd), t.errors.noServer),
    { success: false }
  );

  /* Код набирается в одно поле; server action ждёт те же code-0…code-5,
     что и раньше, — раскладываем перед отправкой. */
  const submitCode = (fd: FormData) => {
    const digits = String(fd.get("code") ?? "").replace(/\D/g, "").slice(0, 6);
    fd.delete("code");
    for (let i = 0; i < 6; i++) fd.set(`code-${i}`, digits[i] ?? "");
    verifyAction(fd);
  };

  // Код отправлен — переходим к шагу «код». Почта уже занята паролем —
  // остаёмся на месте и подсказываем под полем пароля.
  useEffect(() => {
    if (sendState.success && sendState.email) {
      setEmail(sendState.email);
      setStep("code");
      setCountdown(60);
      setTimeout(() => codeRef.current?.focus(), 150);
    } else if (sendState.hasPassword && sendState.email) {
      setEmail(sendState.email);
      setLoginError(t.errors.hasPassword);
      setTimeout(() => pwRef.current?.focus(), 50);
    }
  }, [sendState]);

  useEffect(() => {
    if (verifyState.success && verifyState.needsPassword) {
      setStep("set-password");
    } else if (verifyState.error) {
      codeRef.current?.focus();
      codeRef.current?.select();
    }
  }, [verifyState]);

  useEffect(() => {
    if (loginError) pwRef.current?.focus();
  }, [loginError]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (resetCountdown <= 0) return;
    const t = setTimeout(() => setResetCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resetCountdown]);

  useEffect(() => {
    if (step === "start") {
      emailRef.current?.focus();
    } else if (step === "code") {
      codeRef.current?.focus();
    }
  }, [step]);

  // ─── Code Input Handlers ────────────────────────────────────────

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    if (value.length === 6 && codeFormRef.current && !verifyPending) {
      codeFormRef.current.requestSubmit();
    }
  };

  const handleResetCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResetCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6));
  };

  const handleResendCode = async () => {
    if (countdown > 0 || resendLoading) return;
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setCountdown(60);
        setCode("");
        codeRef.current?.focus();
      }
    } catch {
      // silent
    } finally {
      setResendLoading(false);
    }
  };

  // ─── Login Handler ────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(after);
      } else {
        setLoginError(data.error || t.errors.badLogin);
      }
    } catch {
      setLoginError(t.errors.noConnection);
    } finally {
      setLoginLoading(false);
    }
  };

  const goReset = () => {
    setStep("reset-email");
    setResetEmail(email);
    setResetError("");
  };

  // ─── Set Password Handler ─────────────────────────────────────

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetPasswordError("");

    if (newPassword.length < 6) {
      setSetPasswordError(t.errors.shortPassword);
      newPwRef.current?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setSetPasswordError(t.errors.mismatch);
      confirmPwRef.current?.focus();
      return;
    }

    setSetPasswordLoading(true);

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(after);
      } else {
        setSetPasswordError(data.error || t.errors.savePassword);
      }
    } catch {
      setSetPasswordError(t.errors.server);
    } finally {
      setSetPasswordLoading(false);
    }
  };

  // ─── Reset Password Handlers ──────────────────────────────────

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("reset-code");
        setResetCountdown(60);
        setTimeout(() => resetCodeRef.current?.focus(), 150);
      } else {
        setResetError(data.error || t.errors.sendCode);
      }
    } catch {
      setResetError(t.errors.server);
    } finally {
      setResetLoading(false);
    }
  };

  // Код проверяет сервер ДО шага «новый пароль» и отдаёт одноразовый
  // токен (владелец, 13.09.2026: интерфейс пускал дальше с любым кодом).
  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = resetCodeInput;
    if (entered.length !== 6) {
      setResetError(t.errors.sixDigits);
      resetCodeRef.current?.focus();
      return;
    }
    setResetError("");
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase(), code: entered }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success && data.data?.resetToken) {
        setResetToken(data.data.resetToken);
        setStep("reset-password");
      } else {
        setResetError(data?.error || t.errors.badCode);
        resetCodeRef.current?.focus();
        resetCodeRef.current?.select();
      }
    } catch {
      setResetError(t.errors.noConnectionShort);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (resetPassword1.length < 6) {
      setResetError(t.errors.shortPassword);
      resetPw1Ref.current?.focus();
      return;
    }

    if (resetPassword1 !== resetPassword2) {
      setResetError(t.errors.mismatch);
      resetPw2Ref.current?.focus();
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          resetToken,
          password: resetPassword1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("reset-success");
      } else {
        setResetError(data.error || t.errors.changePassword);
      }
    } catch {
      setResetError(t.errors.server);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (resetCountdown > 0) return;
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setResetCountdown(60);
        setResetCodeInput("");
        resetCodeRef.current?.focus();
      }
    } catch {
      // silent
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

  const emailError = sendState.error || null;
  const codeError = verifyState.error || null;
  const pwMismatch = setPasswordError === t.errors.mismatch;
  const resetMismatch = resetError === t.errors.mismatch;
  const showRef = !!referralCode && step === "start";

  const timer = (left: number) => (
    <span className="av-timer" aria-hidden>
      <i style={{ "--left": left / 60 } as CSSProperties} />
    </span>
  );

  return (
    <div className="v-section av-section v-glow">
      {/* Предмет из Blender. На широком экране он стоит рядом с
          карточкой, на узком — над ней. Атрибут `aria-hidden`: это
          украшение, и диктору о нём говорить нечего. */}
      <div className="av-split">
        <div className="av-art" aria-hidden>
          <img
            src="/media/glass/auth.v1-1400.webp"
            srcSet="/media/glass/auth.v1-700.webp 700w, /media/glass/auth.v1-1400.webp 1400w"
            sizes="(min-width: 1024px) 46vw, 92vw"
            alt=""
            width={1400}
            height={1400}
            decoding="async"
            fetchPriority="low"
            draggable={false}
          />
        </div>
      <div className="v-wrap av-wrap">
        <div className="av-card">
          {/* ── Почта, пароль, код, passkey, Telegram ─────────────── */}
          {step === "start" && (
            <div key="start" className="av-step v-fade-in">
              {showRef && (
                <p className="av-badge-row"><span className="v-badge v-badge-blue">{t.invited}</span></p>
              )}
              <h1 className="av-h1">{fill(t.title, { brand: BRAND })}</h1>
              <p className="av-lead">{fill(t.lead, { trial })}</p>

              <form onSubmit={handleLogin} className="v-form av-form">
                <div className="v-field">
                  <label className="v-label" htmlFor="au-email">{t.email}</label>
                  <input
                    ref={emailRef}
                    id="au-email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="v-input"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={emailError ? true : undefined}
                    aria-describedby={emailError ? "au-email-err" : undefined}
                    required
                  />
                  {emailError && <FieldError id="au-email-err" text={emailError} />}
                </div>

                <PasswordField
                  t={t}
                  id="au-pw"
                  label={t.password}
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                  autoComplete="current-password"
                  inputRef={pwRef}
                  invalid={!!loginError}
                  describedBy={loginError ? "au-login-err" : undefined}
                  labelExtra={<button type="button" onClick={goReset} className="av-link-sm">{t.forgot}</button>}
                />
                {loginError && <FieldError id="au-login-err" text={loginError} />}

                <button type="submit" disabled={loginLoading} className="v-btn v-btn-primary v-btn-block av-submit">
                  {loginLoading ? <Busy>{t.signingIn}</Busy> : t.signIn}
                </button>
              </form>

              <p className="v-or"><span>{t.or}</span></p>

              <form action={sendAction} className="v-form av-form">
                <input type="hidden" name="email" value={email} />
                {referralCode && <input type="hidden" name="ref" value={referralCode} />}
                {next && <input type="hidden" name="next" value={next} />}

                {/* Согласия (владелец, 13.09.2026): Политика — обязательно,
                    новости — по желанию, по умолчанию не отмечено. Ссылки —
                    в новой вкладке, чтобы не потерять форму. */}
                <div className="av-checks">
                  <label className="av-check">
                    <input
                      type="checkbox"
                      name="privacy"
                      value="1"
                      required
                      onInvalid={(e) => e.currentTarget.setCustomValidity(t.consentRequired)}
                      onChange={(e) => e.currentTarget.setCustomValidity("")}
                    />
                    <span>
                      {t.consentBefore}{" "}
                      <a href={to("/privacy")} target="_blank" rel="noopener">{t.consentPrivacy}</a>{" "}
                      {t.consentAnd} <a href={to("/terms")} target="_blank" rel="noopener">{t.consentTerms}</a>
                    </span>
                  </label>
                  <label className="av-check">
                    <input type="checkbox" name="marketing" value="1" />
                    <span>{t.marketing}</span>
                  </label>
                </div>

                <button type="submit" disabled={sendPending} className="v-btn v-btn-outline v-btn-block av-submit">
                  {sendPending ? <Busy>{t.sendingCode}</Busy> : t.getCodeByMail}
                </button>
              </form>

              <div className="av-alt">
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading}
                  className="v-btn v-btn-soft v-btn-block"
                  aria-describedby={passkeyError ? "au-pk-err" : undefined}
                >
                  {passkeyLoading ? <Busy>{t.checking}</Busy> : <><Icon name="shield" size={16} />{t.passkey}</>}
                </button>
                <button
                  type="button"
                  onClick={handleTelegramLogin}
                  disabled={tgLogin.state === "busy" || tgLogin.state === "waiting"}
                  className="v-btn v-btn-soft v-btn-block"
                >
                  {tgLogin.state === "busy" ? <Busy>{t.openingBot}</Busy> : <><Icon name="send" size={16} />{t.telegram}</>}
                </button>
              </div>
              {passkeyError && <FieldError id="au-pk-err" text={passkeyError} />}

              {/* Ожидание подтверждения в боте. Четыре цифры показаны
                  здесь и в боте: человек сверяет их и видит, что
                  подтверждает свой вход, а не подсунутый ссылкой. */}
              {tgLogin.state === "waiting" && (
                <div className="au-tg" role="status">
                  <p className="au-tg-h">{t.tgConfirmTitle}</p>
                  <p className="au-tg-code" aria-label={fill(t.tgConfirmCode, { code: tgLogin.code.split("").join(" ") })}>
                    {tgLogin.code}
                  </p>
                  <p className="au-tg-t">
                    {t.tgConfirmText}
                  </p>
                  {tgLogin.botUrl ? (
                    <a className="v-btn v-btn-soft v-btn-sm" href={tgLogin.botUrl} target="_blank" rel="noopener noreferrer">
                      {t.tgOpenAgain}
                    </a>
                  ) : (
                    <p className="au-tg-t">
                      {t.tgManualBefore} <code>/start {tgLogin.startParam}</code>
                    </p>
                  )}
                </div>
              )}
              {tgLogin.state === "error" && <FieldError id="au-tg-err" text={tgLogin.error} />}
            </div>
          )}

          {/* ── Код ───────────────────────────────────────────────── */}
          {step === "code" && (
            <div key="code" className="av-step v-fade-in">
              <BackButton onClick={() => setStep("start")} label={t.back} />
              <h1 className="av-h1">{t.codeTitle}</h1>
              <p className="av-lead">
                {t.codeSentBefore} <b>{email}</b>{t.codeSentAfter}
              </p>

              <form ref={codeFormRef} action={submitCode} className="v-form av-form">
                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="fingerprint" value={deviceFingerprint} />
                {referralCode && <input type="hidden" name="ref" value={referralCode} />}
                {next && <input type="hidden" name="next" value={next} />}

                <CodeField
                  label={t.codeLabel}
                  id="au-code"
                  name="code"
                  value={code}
                  onChange={handleCodeChange}
                  invalid={!!codeError}
                  describedBy={codeError ? "au-code-err" : undefined}
                  inputRef={codeRef}
                />
                {codeError && <FieldError id="au-code-err" text={codeError} />}

                <button type="submit" disabled={verifyPending} className="v-btn v-btn-primary v-btn-block av-submit">
                  {verifyPending ? <Busy>{t.checking}</Busy> : t.confirm}
                </button>
              </form>

              <div className="av-resend" aria-live="polite">
                {countdown > 0 ? (
                  <>
                    <p className="av-resend-text">
                      {t.resendIn} <b>0:{String(countdown).padStart(2, "0")}</b>
                    </p>
                    {timer(countdown)}
                  </>
                ) : (
                  <button type="button" onClick={handleResendCode} disabled={resendLoading} className="v-btn v-btn-soft">
                    {resendLoading ? <Busy>{t.sending}</Busy> : <><Icon name="refresh" size={16} />{t.resend}</>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Пароль для новых ────────────────────────────────────── */}
          {step === "set-password" && (
            <div key="set-password" className="av-step v-fade-in">
              <h1 className="av-h1">{t.setPwTitle}</h1>
              <p className="av-lead">{t.setPwLead}</p>

              <form onSubmit={handleSetPassword} className="v-form av-form">
                <PasswordField
                  t={t}
                  id="au-new-pw"
                  label={t.password}
                  hint={t.pwHint}
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNewPassword}
                  onToggle={() => setShowNewPassword(!showNewPassword)}
                  autoComplete="new-password"
                  autoFocus
                  inputRef={newPwRef}
                  invalid={!!setPasswordError && !pwMismatch}
                  describedBy={setPasswordError && !pwMismatch ? "au-setpw-err" : undefined}
                />
                {setPasswordError && !pwMismatch && <FieldError id="au-setpw-err" text={setPasswordError} />}

                <PasswordField
                  t={t}
                  id="au-new-pw2"
                  label={t.repeatPassword}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                  autoComplete="new-password"
                  inputRef={confirmPwRef}
                  invalid={pwMismatch}
                  describedBy={pwMismatch ? "au-setpw-err2" : undefined}
                />
                {pwMismatch && <FieldError id="au-setpw-err2" text={setPasswordError} />}

                <button type="submit" disabled={setPasswordLoading} className="v-btn v-btn-primary v-btn-block av-submit">
                  {setPasswordLoading ? <Busy>{t.saving}</Busy> : t.savePassword}
                </button>
                <button type="button" onClick={() => router.push(after)} className="v-btn v-btn-soft v-btn-block">
                  {t.skip}
                </button>
              </form>
            </div>
          )}

          {/* ── Восстановление · 1 · почта ──────────────────────────── */}
          {step === "reset-email" && (
            <div key="reset-email" className="av-step v-fade-in">
              <BackButton onClick={() => setStep("start")} label={t.back} />
              <h1 className="av-h1">{t.resetTitle}</h1>
              <p className="av-lead">{t.resetLead}</p>

              <form onSubmit={handleSendResetCode} className="v-form av-form">
                <div className="v-field">
                  <label className="v-label" htmlFor="au-reset-email">{t.email}</label>
                  <input
                    id="au-reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    className="v-input"
                    aria-invalid={resetError ? true : undefined}
                    aria-describedby={resetError ? "au-reset-err" : undefined}
                    required
                  />
                  {resetError && <FieldError id="au-reset-err" text={resetError} />}
                </div>

                <button type="submit" disabled={resetLoading} className="v-btn v-btn-primary v-btn-block av-submit">
                  {resetLoading ? <Busy>{t.sending}</Busy> : t.getCode}
                </button>
              </form>
            </div>
          )}

          {/* ── Восстановление · 2 · код ────────────────────────────── */}
          {step === "reset-code" && (
            <div key="reset-code" className="av-step v-fade-in">
              <BackButton onClick={() => setStep("reset-email")} label={t.back} />
              <h1 className="av-h1">{t.codeTitle}</h1>
              <p className="av-lead">
                {t.codeSentBefore} <b>{resetEmail}</b>{t.codeSentAfter}
              </p>

              <form onSubmit={handleVerifyResetCode} className="v-form av-form">
                <CodeField
                  label={t.codeLabel}
                  id="au-reset-code"
                  value={resetCodeInput}
                  onChange={handleResetCodeChange}
                  invalid={!!resetError}
                  describedBy={resetError ? "au-rcode-err" : undefined}
                  inputRef={resetCodeRef}
                />
                {resetError && <FieldError id="au-rcode-err" text={resetError} />}

                <button type="submit" disabled={resetLoading} className="v-btn v-btn-primary v-btn-block av-submit">
                  {resetLoading ? <Busy>{t.checking}</Busy> : t.confirm}
                </button>
              </form>

              <div className="av-resend" aria-live="polite">
                {resetCountdown > 0 ? (
                  <>
                    <p className="av-resend-text">
                      {t.resendIn}{" "}
                      <b>{Math.floor(resetCountdown / 60)}:{String(resetCountdown % 60).padStart(2, "0")}</b>
                    </p>
                    {timer(resetCountdown)}
                  </>
                ) : (
                  <button type="button" onClick={handleResendResetCode} className="v-btn v-btn-soft">
                    <Icon name="refresh" size={16} />
                    {t.resend}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Восстановление · 3 · новый пароль ───────────────────── */}
          {step === "reset-password" && (
            <div key="reset-password" className="av-step v-fade-in">
              <BackButton onClick={() => setStep("reset-code")} label={t.back} />
              <h1 className="av-h1">{t.newPassword}</h1>
              <p className="av-lead">{t.newPasswordLead}</p>

              <form onSubmit={handleResetPassword} className="v-form av-form">
                <PasswordField
                  t={t}
                  id="au-reset-pw"
                  label={t.newPassword}
                  hint={t.pwHint}
                  value={resetPassword1}
                  onChange={setResetPassword1}
                  show={showResetPassword1}
                  onToggle={() => setShowResetPassword1(!showResetPassword1)}
                  autoComplete="new-password"
                  autoFocus
                  inputRef={resetPw1Ref}
                  invalid={!!resetError && !resetMismatch}
                  describedBy={resetError && !resetMismatch ? "au-rpw-err" : undefined}
                />
                {resetError && !resetMismatch && <FieldError id="au-rpw-err" text={resetError} />}

                <PasswordField
                  t={t}
                  id="au-reset-pw2"
                  label={t.repeatPassword}
                  value={resetPassword2}
                  onChange={setResetPassword2}
                  show={showResetPassword2}
                  onToggle={() => setShowResetPassword2(!showResetPassword2)}
                  autoComplete="new-password"
                  inputRef={resetPw2Ref}
                  invalid={resetMismatch}
                  describedBy={resetMismatch ? "au-rpw-err2" : undefined}
                />
                {resetMismatch && <FieldError id="au-rpw-err2" text={resetError} />}

                <button type="submit" disabled={resetLoading} className="v-btn v-btn-primary v-btn-block av-submit">
                  {resetLoading ? <Busy>{t.saving}</Busy> : t.savePassword}
                </button>
              </form>
            </div>
          )}

          {/* ── Восстановление · готово ──────────────────────────────── */}
          {step === "reset-success" && (
            <div key="reset-success" className="av-step v-fade-in">
              <span className="av-done" aria-hidden><Icon name="check" size={26} /></span>
              <h1 className="av-h1">{t.changedTitle}</h1>
              <p className="av-lead">{t.changedLead}</p>
              <div className="v-form av-form">
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    setStep("start");
                    setEmail(resetEmail);
                    setPassword("");
                    setLoginError("");
                  }}
                  className="v-btn v-btn-primary v-btn-block av-submit"
                >
                  {t.signIn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
