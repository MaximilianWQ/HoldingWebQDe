"use client";

import { useState, useRef, useEffect, useActionState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import Icon, { type IconName } from "@/components/pixel/Icon";
import Corner from "@/components/atlas/Corner";
import OrbGL from "@/components/atlas/OrbGL";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { DEVICE_LIMIT } from "@/lib/plans";
import { COUNTRY_COUNT, plural } from "@/lib/locations";
import { sendCodeAction, verifyCodeAction, type SendCodeState, type VerifyCodeState } from "./actions";
import "@/app/work-atlas.css";
import "./auth/auth-atlas.css";

/** Вызов server action, который при отказе запроса возвращает ошибку
 *  в состояние формы, а не бросает её в границу ошибок страницы. */
async function guardAction<S extends { success: boolean; error?: string }>(run: () => Promise<S>): Promise<S> {
  try {
    return await run();
  } catch (e) {
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e; // redirect / notFound
    return { success: false, error: "Не удалось связаться с сервером. Обновите страницу и попробуйте ещё раз." } as S;
  }
}

/**
 * Вход на корпусе «Атлас-издание» — рабочий экран в стиле кабинета.
 *
 * Доска (скруглённая рама) держит полосу шагов и две панели: слева
 * форма текущего шага, справа тёмная плита «что даёт вход». На телефоне
 * одна колонка: форма первой, поле шага видно без прокрутки.
 *
 * Логика прежнего экрана перенесена без изменений: шаги email → code →
 * set-password, login, reset-email → reset-code → reset-password →
 * reset-success; server actions sendCodeAction / verifyCodeAction;
 * запросы /api/auth/*; passkey; реферальный код; отпечаток устройства;
 * редиректы. Одно изменение ввода: код набирается в ОДНО поле (шесть
 * клеток — только рисунок), а в server action уходят те же поля
 * code-0…code-5. Одно поле даёт iOS/Android подставить код из письма
 * и держит тап-зону во всю ширину даже на 320px.
 *
 * Полоса шагов, «Шаг N из M», въезд шага и пункты плиты — общий слой
 * мастеров (work-atlas.css: .ak-stepper, .ak-kicker-step, .ak-enter,
 * .ak-perks). Своё движение — auth/auth-atlas.css, раздел «Движение».
 */

type AuthStep =
  | "email"
  | "code"
  | "set-password"
  | "login"
  | "reset-email"
  | "reset-code"
  | "reset-password"
  | "reset-success";

interface AuthPageProps {
  initialStep: "email" | "code";
  initialEmail: string;
  referralCode?: string;
  /** Куда вернуть после входа (проверенный путь сайта, auth/page.tsx); по умолчанию — кабинет. */
  next?: string;
}

/* Полоса шагов: у каждого сценария свой ряд. */
const FLOWS = {
  code: ["Почта", "Код", "Пароль"],
  login: ["Почта и пароль"],
  reset: ["Почта", "Код", "Новый пароль"],
} as const;
const STEP_POS: Record<AuthStep, [keyof typeof FLOWS, number]> = {
  email: ["code", 0],
  code: ["code", 1],
  "set-password": ["code", 2],
  login: ["login", 0],
  "reset-email": ["reset", 0],
  "reset-code": ["reset", 1],
  "reset-password": ["reset", 2],
  "reset-success": ["reset", 3],
};

const at = (i: number) => ({ "--i": i }) as CSSProperties;
const k = (n: number) => ({ "--k": n }) as CSSProperties;

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
  // Simple hash
  const str = parts.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/* ─── Мелкие части формы ─────────────────────────────────────────── */

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="a-btn ak-btn-soft au-back">
      <Icon name="arrow-right" size={16} />
      Назад
    </button>
  );
}

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="au-err" role="alert">
      <i aria-hidden />
      {text}
    </p>
  );
}

function Busy({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="au-spin" aria-hidden />
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
}: {
  id: string;
  label: string;
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
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const described = [hintId, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="au-field">
      <label className="au-label" htmlFor={id}>{label}</label>
      <div className="au-control au-control-pw">
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
          className="au-input"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={described}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="au-peek"
          aria-pressed={show}
          aria-controls={id}
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
        >
          {show ? "Скрыть" : "Показать"}
        </button>
      </div>
      {hint && <p id={hintId} className="au-hint">{hint}</p>}
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
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  invalid?: boolean;
  describedBy?: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const active = Math.min(value.length, 5);
  return (
    <div className="au-field">
      <label className="au-label" htmlFor={id}>Код из письма — 6 цифр</label>
      <div className="au-code" data-invalid={invalid ? "" : undefined}>
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
          className="au-code-input"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          required
        />
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="au-cell"
            aria-hidden
            data-filled={value[i] ? "" : undefined}
            data-active={i === active ? "" : undefined}
          >
            {value[i] ? <b key={`${i}-${value[i]}`}>{value[i]}</b> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function Perk({ icon, title, text, n }: { icon: IconName; title: string; text: string; n: number }) {
  return (
    <li className="ak-perk" style={k(n)}>
      <span className="ak-perk-ico" style={k(n)}><Icon name={icon} size={20} /></span>
      <span className="ak-perk-copy">
        <b className="ak-perk-title">{title}</b>
        <span className="ak-perk-text">{text}</span>
      </span>
    </li>
  );
}

export default function AuthPage({ initialStep, initialEmail, referralCode, next }: AuthPageProps) {
  const router = useRouter();
  const after = next || "/dashboard";
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [countdown, setCountdown] = useState(initialStep === "code" ? 60 : 0);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeFormRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");

  // Resend loading state
  const [resendLoading, setResendLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const loginPwRef = useRef<HTMLInputElement>(null);

  // Passkey state
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");

  // Set password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setPasswordError, setSetPasswordError] = useState("");
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const newPwRef = useRef<HTMLInputElement>(null);
  const confirmPwRef = useRef<HTMLInputElement>(null);

  // Reset password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetCodeInput, setResetCodeInput] = useState("");
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
        setPasskeyError(verData.error || "Ключ не распознан");
      }
    } catch (err) {
      if ((err as Error).name === "NotAllowedError") {
        setPasskeyError("");
      } else {
        setPasskeyError("Не получилось войти через Passkey. Войдите по коду из письма.");
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  // ─── Server Actions ───────────────────────────────────────────
  // Отказ самого запроса (сервер отклонил действие, сеть, устаревшая
  // вкладка после выкладки) не должен ронять страницу в «This page
  // couldn't load» — показываем ошибку у поля. Переход (redirect)
  // пробрасываем дальше: его обрабатывает роутер Next.
  const [sendState, sendAction, sendPending] = useActionState(
    (prev: SendCodeState, fd: FormData) => guardAction(() => sendCodeAction(prev, fd)),
    { success: false }
  );

  const [verifyState, verifyAction, verifyPending] = useActionState(
    (prev: VerifyCodeState, fd: FormData) => guardAction(() => verifyCodeAction(prev, fd)),
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

  // When send-code succeeds or user has password
  useEffect(() => {
    if (sendState.success && sendState.email) {
      setEmail(sendState.email);
      setStep("code");
      setCountdown(60);
      setTimeout(() => codeRef.current?.focus(), 150);
    } else if (sendState.hasPassword && sendState.email) {
      setLoginEmail(sendState.email);
      setLoginPassword("");
      setLoginError("");
      setStep("login");
    }
  }, [sendState]);

  // When verify-code succeeds and needs password
  useEffect(() => {
    if (verifyState.success && verifyState.needsPassword) {
      setStep("set-password");
    } else if (verifyState.error) {
      // Неверный код: выделяем набранное — новый набор его заменит.
      codeRef.current?.focus();
      codeRef.current?.select();
    }
  }, [verifyState]);

  // Ошибка входа: кнопка на время запроса выключена и фокус теряется —
  // возвращаем его в поле пароля, рядом с которым стоит ошибка.
  useEffect(() => {
    if (loginError) loginPwRef.current?.focus();
  }, [loginError]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Reset countdown timer
  useEffect(() => {
    if (resetCountdown <= 0) return;
    const t = setTimeout(() => setResetCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resetCountdown]);

  // Auto-focus on mount
  useEffect(() => {
    if (step === "email") {
      emailRef.current?.focus();
    } else if (step === "code") {
      codeRef.current?.focus();
    }
  }, [step]);

  // ─── Code Input Handlers ────────────────────────────────────────

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    // Как раньше: шестая цифра (или вставка всех шести) отправляет форму.
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
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(after);
      } else {
        setLoginError(data.error || "Не получилось войти. Проверьте почту и пароль.");
      }
    } catch {
      setLoginError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setLoginLoading(false);
    }
  };

  const goReset = () => {
    setStep("reset-email");
    setResetEmail(loginEmail);
    setResetError("");
  };

  // ─── Set Password Handler ─────────────────────────────────────

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetPasswordError("");

    if (newPassword.length < 6) {
      setSetPasswordError("Пароль должен содержать минимум 6 символов");
      newPwRef.current?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setSetPasswordError("Пароли не совпадают");
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
        setSetPasswordError(data.error || "Ошибка сохранения пароля");
      }
    } catch {
      setSetPasswordError("Ошибка сервера. Попробуйте позже.");
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
        setResetError(data.error || "Ошибка отправки кода");
      }
    } catch {
      setResetError("Ошибка сервера. Попробуйте позже.");
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
      setResetError("Введите код из 6 цифр");
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
        setResetCode(data.data.resetToken);
        setStep("reset-password");
      } else {
        setResetError(data?.error || "Неверный код");
        resetCodeRef.current?.focus();
        resetCodeRef.current?.select();
      }
    } catch {
      setResetError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (resetPassword1.length < 6) {
      setResetError("Пароль должен содержать минимум 6 символов");
      resetPw1Ref.current?.focus();
      return;
    }

    if (resetPassword1 !== resetPassword2) {
      setResetError("Пароли не совпадают");
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
          // В resetCode после проверки лежит одноразовый токен, не код.
          resetToken: resetCode,
          password: resetPassword1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("reset-success");
      } else {
        setResetError(data.error || "Ошибка смены пароля");
      }
    } catch {
      setResetError("Ошибка сервера. Попробуйте позже.");
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
  const [flow, pos] = STEP_POS[step];
  const steps = FLOWS[flow];
  const stepLabel = steps.length > 1 && pos < steps.length ? `Шаг ${pos + 1} из ${steps.length}` : null;
  const trialLabel = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;
  // Ошибки паролей: «не совпадают» — у второго поля, остальные — у первого.
  const pwMismatch = setPasswordError === "Пароли не совпадают";
  const resetMismatch = resetError === "Пароли не совпадают";
  const cameFromEmail = !!sendState.hasPassword && sendState.email === loginEmail;
  const showRef = !!referralCode && (step === "email" || step === "code");

  const timer = (left: number) => (
    <span className="au-timer" aria-hidden>
      <i style={{ "--left": left / 60 } as CSSProperties} />
    </span>
  );

  return (
    <main id="main" className="a-main ak au">
      <div className="a-field">
        <div className="ak-board au-board">
          {/* Полоса шагов: где вы и сколько осталось. */}
          <div className="ak-bar au-bar" data-sheet="21">
            <span className="ak-avatar ak-mark" aria-hidden>
              <Icon name="lock" size={18} />
            </span>
            <ol className="ak-stepper" aria-label={flow === "reset" ? "Восстановление пароля" : "Вход"}>
              {steps.map((label, n) => {
                const state = n < pos ? "done" : n === pos ? "now" : "next";
                return (
                  <li key={label}>
                    <span className="ak-step" data-state={state} aria-current={state === "now" ? "step" : undefined}>
                      <span className="ak-step-n">
                        {state === "done" ? <Icon name="check" size={14} /> : n + 1}
                      </span>
                      <span className="ak-step-label">
                        {label}
                        {state === "done" && <span className="b-sr"> — готово</span>}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <span className="ak-bar-plan">{trialLabel} бесплатно</span>
          </div>

          <div className="au-grid">
            {/* ── Форма текущего шага ──────────────────────────────── */}
            <section className="ak-card au-form-card" data-sheet="21" style={at(0)} aria-labelledby="au-h">
              <div key={step} className="ak-enter">
                <div className="ak-card-head au-head">
                  {step === "code" && <BackButton onClick={() => setStep("email")} />}
                  {step === "login" && <BackButton onClick={() => setStep("email")} />}
                  {step === "reset-email" && <BackButton onClick={() => setStep("login")} />}
                  {step === "reset-code" && <BackButton onClick={() => setStep("reset-email")} />}
                  {step === "reset-password" && <BackButton onClick={() => setStep("reset-code")} />}
                  <p className="ak-eyebrow">
                    {flow === "reset" && step !== "reset-success" ? "Новый пароль" : flow === "login" ? "Вход по паролю" : "Вход или регистрация"}
                    {stepLabel && <> · <span className="a-num ak-kicker-step">{stepLabel}</span></>}
                  </p>
                  {showRef && <span className="ak-status au-ref"><i />По приглашению</span>}
                </div>

                {/* ── 1 · Почта ─────────────────────────────────────── */}
                {step === "email" && (
                  <>
                    <h1 id="au-h" className="ak-h1 au-h1">Войдите по почте</h1>
                    <p className="au-lead">
                      Пришлём код из 6 цифр. Нет аккаунта — создадим его сами и сразу включим {trialLabel} бесплатно.
                    </p>

                    <form action={sendAction} className="au-form">
                      {/* Pass referral code through the form */}
                      {referralCode && <input type="hidden" name="ref" value={referralCode} />}
                      {next && <input type="hidden" name="next" value={next} />}

                      <div className="au-field">
                        <label className="au-label" htmlFor="au-email">Почта</label>
                        <div className="au-control">
                          <input
                            ref={emailRef}
                            id="au-email"
                            name="email"
                            type="email"
                            placeholder="name@example.com"
                            defaultValue={initialEmail}
                            className="au-input"
                            autoComplete="email"
                            inputMode="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            enterKeyHint="go"
                            aria-invalid={emailError ? true : undefined}
                            aria-describedby={emailError ? "au-email-err" : undefined}
                            required
                          />
                        </div>
                        {emailError && <FieldError id="au-email-err" text={emailError} />}
                      </div>

                      {/* Согласия (владелец, 13.09.2026): Политика — обязательно,
                          новости — по желанию, по умолчанию не отмечено. Ссылки —
                          в новой вкладке, чтобы не потерять форму. */}
                      <div className="au-checks">
                        <label className="au-check">
                          <input
                            type="checkbox"
                            name="privacy"
                            value="1"
                            required
                            // Подсказка браузера — по-русски при любом языке системы.
                            onInvalid={(e) => e.currentTarget.setCustomValidity("Отметьте согласие с Политикой, чтобы продолжить")}
                            onChange={(e) => e.currentTarget.setCustomValidity("")}
                          />
                          <span>
                            Я соглашаюсь с{" "}
                            <a href="/privacy" target="_blank" rel="noopener">Политикой обработки персональных данных</a>{" "}
                            и <a href="/terms" target="_blank" rel="noopener">Условиями использования</a>
                          </span>
                        </label>
                        <label className="au-check">
                          <input type="checkbox" name="marketing" value="1" />
                          <span>Хочу получать новости и специальные предложения</span>
                        </label>
                      </div>

                      <button type="submit" disabled={sendPending} className="a-btn a-btn-primary au-submit">
                        {sendPending ? <Busy>Отправляем код…</Busy> : <>Получить код <Icon name="arrow-right" size={16} className="au-arrow" /></>}
                      </button>
                    </form>

                    <p className="au-or"><span>или</span></p>

                    <div className="au-alt">
                      <button
                        type="button"
                        onClick={() => { setStep("login"); setLoginError(""); }}
                        className="a-btn ak-btn-soft"
                      >
                        <Icon name="lock" size={16} />
                        Войти по паролю
                      </button>
                      <button
                        type="button"
                        onClick={handlePasskeyLogin}
                        disabled={passkeyLoading}
                        className="a-btn ak-btn-soft"
                        aria-describedby={passkeyError ? "au-pk-err" : "au-pk-hint"}
                      >
                        {passkeyLoading ? <Busy>Проверяем…</Busy> : <><Icon name="shield" size={16} />Войти через Passkey</>}
                      </button>
                    </div>
                    {passkeyError ? (
                      <FieldError id="au-pk-err" text={passkeyError} />
                    ) : (
                      <p id="au-pk-hint" className="ak-fine">Passkey — вход отпечатком, лицом или PIN-кодом устройства.</p>
                    )}
                  </>
                )}

                {/* ── 2 · Код ───────────────────────────────────────── */}
                {step === "code" && (
                  <>
                    <h1 id="au-h" className="ak-h1 au-h1">Введите код</h1>
                    <p className="au-lead">
                      Отправили письмо на <b className="au-mail">{email}</b>. Не видите — загляните в «Спам».
                    </p>

                    <form ref={codeFormRef} action={submitCode} className="au-form">
                      <input type="hidden" name="email" value={email} />
                      <input type="hidden" name="fingerprint" value={deviceFingerprint} />
                      {referralCode && <input type="hidden" name="ref" value={referralCode} />}
                      {next && <input type="hidden" name="next" value={next} />}

                      <CodeField
                        id="au-code"
                        name="code"
                        value={code}
                        onChange={handleCodeChange}
                        invalid={!!codeError}
                        describedBy={codeError ? "au-code-err" : undefined}
                        inputRef={codeRef}
                      />
                      {codeError && <FieldError id="au-code-err" text={codeError} />}

                      <button type="submit" disabled={verifyPending} className="a-btn a-btn-primary au-submit">
                        {verifyPending ? <Busy>Проверяем…</Busy> : <>Подтвердить <Icon name="arrow-right" size={16} className="au-arrow" /></>}
                      </button>
                    </form>

                    <div className="au-resend" aria-live="polite">
                      {countdown > 0 ? (
                        <>
                          <p className="au-resend-text">
                            Отправить ещё раз через <b className="a-num">0:{String(countdown).padStart(2, "0")}</b>
                          </p>
                          {timer(countdown)}
                        </>
                      ) : (
                        <button type="button" onClick={handleResendCode} disabled={resendLoading} className="a-btn ak-btn-soft">
                          {resendLoading ? <Busy>Отправляем…</Busy> : <><Icon name="refresh" size={16} />Отправить код ещё раз</>}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* ── 3 · Пароль для новых ──────────────────────────── */}
                {step === "set-password" && (
                  <>
                    <h1 id="au-h" className="ak-h1 au-h1">Придумайте пароль</h1>
                    <p className="au-lead">В следующий раз войдёте по почте и паролю — без ожидания письма. Шаг можно пропустить.</p>

                    <form onSubmit={handleSetPassword} className="au-form">
                      <PasswordField
                        id="au-new-pw"
                        label="Пароль"
                        hint="Не короче 6 символов"
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
                        id="au-new-pw2"
                        label="Повторите пароль"
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

                      <button type="submit" disabled={setPasswordLoading} className="a-btn a-btn-primary au-submit">
                        {setPasswordLoading ? <Busy>Сохраняем…</Busy> : "Сохранить пароль"}
                      </button>
                      <button type="button" onClick={() => router.push(after)} className="a-btn ak-btn-soft au-submit">
                        Пропустить
                      </button>
                    </form>
                  </>
                )}

                {/* ── Вход по паролю ────────────────────────────────── */}
                {step === "login" && (
                  <>
                    <h1 id="au-h" className="ak-h1 au-h1">С возвращением</h1>
                    <p className="au-lead">
                      {cameFromEmail
                        ? "У этой почты уже есть пароль — войдите с ним."
                        : "Введите почту и пароль от аккаунта."}
                    </p>

                    <form onSubmit={handleLogin} className="au-form">
                      <div className="au-field">
                        <label className="au-label" htmlFor="au-login-email">Почта</label>
                        <div className="au-control">
                          <input
                            id="au-login-email"
                            type="email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="name@example.com"
                            autoComplete="email"
                            inputMode="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            autoFocus={!cameFromEmail}
                            className="au-input"
                            aria-invalid={loginError ? true : undefined}
                            aria-describedby={loginError ? "au-login-err" : undefined}
                            required
                          />
                        </div>
                      </div>

                      <PasswordField
                        id="au-login-pw"
                        label="Пароль"
                        value={loginPassword}
                        onChange={setLoginPassword}
                        show={showLoginPassword}
                        onToggle={() => setShowLoginPassword(!showLoginPassword)}
                        autoComplete="current-password"
                        autoFocus={cameFromEmail}
                        inputRef={loginPwRef}
                        invalid={!!loginError}
                        describedBy={loginError ? "au-login-err" : undefined}
                      />
                      {loginError && <FieldError id="au-login-err" text={loginError} />}

                      <button type="submit" disabled={loginLoading} className="a-btn a-btn-primary au-submit">
                        {loginLoading ? <Busy>Входим…</Busy> : <>Войти <Icon name="arrow-right" size={16} className="au-arrow" /></>}
                      </button>
                    </form>

                    <div className="au-alt">
                      <button type="button" onClick={goReset} className="a-btn ak-btn-soft" data-state={loginError ? "hint" : undefined}>
                        <Icon name="refresh" size={16} />
                        {loginError ? "Сбросить пароль" : "Забыли пароль?"}
                      </button>
                    </div>
                  </>
                )}

                {/* ── Восстановление · 1 · почта ────────────────────── */}
                {step === "reset-email" && (
                  <>
                    <h1 id="au-h" className="ak-h1 au-h1">Восстановим доступ</h1>
                    <p className="au-lead">Укажите почту аккаунта — пришлём код для нового пароля.</p>

                    <form onSubmit={handleSendResetCode} className="au-form">
                      <div className="au-field">
                        <label className="au-label" htmlFor="au-reset-email">Почта</label>
                        <div className="au-control">
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
                            className="au-input"
                            aria-invalid={resetError ? true : undefined}
                            aria-describedby={resetError ? "au-reset-err" : undefined}
                            required
                          />
                        </div>
                        {resetError && <FieldError id="au-reset-err" text={resetError} />}
                      </div>

                      <button type="submit" disabled={resetLoading} className="a-btn a-btn-primary au-submit">
                        {resetLoading ? <Busy>Отправляем…</Busy> : <>Получить код <Icon name="arrow-right" size={16} className="au-arrow" /></>}
                      </button>
                    </form>
                  </>
                )}

                {/* ── Восстановление · 2 · код ──────────────────────── */}
                {step === "reset-code" && (
                  <>
                    <h1 id="au-h" className="ak-h1 au-h1">Введите код</h1>
                    <p className="au-lead">
                      Отправили письмо на <b className="au-mail">{resetEmail}</b>. Не видите — загляните в «Спам».
                    </p>

                    <form onSubmit={handleVerifyResetCode} className="au-form">
                      <CodeField
                        id="au-reset-code"
                        value={resetCodeInput}
                        onChange={handleResetCodeChange}
                        invalid={!!resetError}
                        describedBy={resetError ? "au-rcode-err" : undefined}
                        inputRef={resetCodeRef}
                      />
                      {resetError && <FieldError id="au-rcode-err" text={resetError} />}

                      <button type="submit" disabled={resetLoading} className="a-btn a-btn-primary au-submit">
                        {resetLoading ? <Busy>Проверяем…</Busy> : <>Подтвердить <Icon name="arrow-right" size={16} className="au-arrow" /></>}
                      </button>
                    </form>

                    <div className="au-resend" aria-live="polite">
                      {resetCountdown > 0 ? (
                        <>
                          <p className="au-resend-text">
                            Отправить ещё раз через{" "}
                            <b className="a-num">
                              {Math.floor(resetCountdown / 60)}:{String(resetCountdown % 60).padStart(2, "0")}
                            </b>
                          </p>
                          {timer(resetCountdown)}
                        </>
                      ) : (
                        <button type="button" onClick={handleResendResetCode} className="a-btn ak-btn-soft">
                          <Icon name="refresh" size={16} />
                          Отправить код ещё раз
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* ── Восстановление · 3 · новый пароль ─────────────── */}
                {step === "reset-password" && (
                  <>
                    <h1 id="au-h" className="ak-h1 au-h1">Новый пароль</h1>
                    <p className="au-lead">С ним и почтой вы будете входить дальше.</p>

                    <form onSubmit={handleResetPassword} className="au-form">
                      <PasswordField
                        id="au-reset-pw"
                        label="Новый пароль"
                        hint="Не короче 6 символов"
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
                        id="au-reset-pw2"
                        label="Повторите пароль"
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

                      <button type="submit" disabled={resetLoading} className="a-btn a-btn-primary au-submit">
                        {resetLoading ? <Busy>Сохраняем…</Busy> : "Сохранить пароль"}
                      </button>
                    </form>
                  </>
                )}

                {/* ── Восстановление · готово ───────────────────────── */}
                {step === "reset-success" && (
                  <>
                    <span className="au-done" aria-hidden><Icon name="check" size={28} /></span>
                    <h1 id="au-h" className="ak-h1 au-h1">Пароль изменён</h1>
                    <p className="au-lead">Теперь войдите с новым паролем.</p>
                    <div className="au-form">
                      <button
                        type="button"
                        autoFocus
                        onClick={() => {
                          setStep("login");
                          setLoginEmail(resetEmail);
                          setLoginPassword("");
                          setLoginError("");
                        }}
                        className="a-btn a-btn-primary au-submit"
                      >
                        Войти <Icon name="arrow-right" size={16} className="au-arrow" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ── Что даёт вход ────────────────────────────────────── */}
            <section className="ak-card ak-dark ak-has-orb au-perks-card" data-sheet="21" style={at(1)} aria-labelledby="au-perks-h">
              <Corner href="/pricing" label="Тарифы и цены" />
              <OrbGL className="ak-orb" theme="dark" state="active" />
              <div className="ak-card-head">
                <h2 id="au-perks-h" className="ak-eyebrow">Что даёт вход</h2>
              </div>
              <p className="ak-dark-title">Интернет без просадок — сразу после входа</p>
              <ul className="ak-perks">
                <Perk
                  n={0}
                  icon="clock"
                  title={`${trialLabel} бесплатно`}
                  text="Пробный период включается сам. Карта не нужна."
                />
                <Perk
                  n={1}
                  icon="devices"
                  title={`До ${DEVICE_LIMIT} устройств`}
                  text="Телефон, ноутбук и телевизор — на одной подписке."
                />
                <Perk
                  n={2}
                  icon="globe"
                  title={`${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])}`}
                  text="Выбирайте, через какую страну подключаться."
                />
              </ul>
              <div className="ak-actions">
                <a href="/support" className="a-btn ak-btn-soft">
                  <Icon name="chat" size={16} />
                  Помощь со входом
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
