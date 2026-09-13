/**
 * YooKassa (ЮКасса) Payment Integration
 *
 * API docs: https://yookassa.ru/developers/api
 * Auth: Basic Auth with shopId:secretKey
 * Idempotency: Idempotence-Key header (UUID v4)
 */

import { v4 as uuidv4 } from "uuid";

const DEFAULT_YOOKASSA_API_URL = "https://api.yookassa.ru/v3";
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || "";
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || "";

/**
 * API base. YOOKASSA_API_URL_OVERRIDE points a local run (end-to-end check
 * against a fake cashier) elsewhere; it is IGNORED in production builds,
 * so a stray env value can never divert real payments.
 */
function apiUrl(): string {
  const override = process.env.NODE_ENV !== "production" ? (process.env.YOOKASSA_API_URL_OVERRIDE || "").trim() : "";
  return (override || DEFAULT_YOOKASSA_API_URL).replace(/\/+$/, "");
}

// ─── Types ──────────────────────────────────────────────────────

export interface YooKassaAmount {
  value: string; // e.g. "100.00"
  currency: string; // "RUB"
}

export interface YooKassaPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  amount: YooKassaAmount;
  description?: string;
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  paid: boolean;
  created_at: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentParams {
  amount: number;
  currency?: string;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  transactionId: string;
  redirect: string;
  status: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function getAuthHeader(): string {
  return "Basic " + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString("base64");
}

function ensureConfigured(): void {
  if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
    console.error("[YOOKASSA] Missing YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY");
    throw new Error("Payment system not configured");
  }
}

// ─── Create Payment ─────────────────────────────────────────────

export async function createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
  ensureConfigured();

  const body = {
    amount: {
      value: params.amount.toFixed(2),
      currency: params.currency || "RUB",
    },
    confirmation: {
      type: "redirect",
      return_url: params.returnUrl,
    },
    capture: true, // auto-capture (one-step payment)
    description: params.description,
    metadata: params.metadata || {},
  };

  const res = await fetch(`${apiUrl()}/payments`, {
    method: "POST",
    headers: {
      "Authorization": getAuthHeader(),
      "Idempotence-Key": uuidv4(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[YOOKASSA] Create payment failed: ${res.status} ${text}`);
    throw new Error(`Payment creation failed: ${res.status}`);
  }

  const data: YooKassaPayment = await res.json();

  if (!data.confirmation?.confirmation_url) {
    console.error("[YOOKASSA] No confirmation URL in response:", JSON.stringify(data));
    throw new Error("No confirmation URL returned");
  }

  console.log(`[YOOKASSA] Payment created: ${data.id} (${data.status})`);

  return {
    transactionId: data.id,
    redirect: data.confirmation.confirmation_url,
    status: data.status,
  };
}

// ─── Get Payment Status ─────────────────────────────────────────

export async function getPaymentStatus(paymentId: string): Promise<YooKassaPayment> {
  ensureConfigured();

  const res = await fetch(`${apiUrl()}/payments/${paymentId}`, {
    method: "GET",
    headers: {
      "Authorization": getAuthHeader(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[YOOKASSA] Get payment failed: ${res.status} ${text}`);
    throw new Error(`Payment status check failed: ${res.status}`);
  }

  return res.json();
}

// ─── Refunds ────────────────────────────────────────────────────

export interface YooKassaRefund {
  id: string;
  payment_id: string;
  status: "pending" | "succeeded" | "canceled";
  amount: YooKassaAmount;
  created_at: string;
  description?: string;
}

/** GET /v3/refunds/{id} — used to verify a refund.succeeded notification. */
export async function getRefund(refundId: string): Promise<YooKassaRefund> {
  ensureConfigured();
  const res = await fetch(`${apiUrl()}/refunds/${encodeURIComponent(refundId)}`, {
    method: "GET",
    headers: { Authorization: getAuthHeader() },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[YOOKASSA] Get refund failed: ${res.status} ${text}`);
    throw new Error(`Refund status check failed: ${res.status}`);
  }
  return res.json();
}

// ─── Payment Status Constants ───────────────────────────────────

export const PaymentStatus = {
  PENDING: "pending",
  WAITING_FOR_CAPTURE: "waiting_for_capture",
  SUCCEEDED: "succeeded",
  CANCELED: "canceled",
} as const;

// ─── Webhook Notification Types ─────────────────────────────────

export interface YooKassaNotification {
  type: "notification";
  event: "payment.succeeded" | "payment.canceled" | "payment.waiting_for_capture" | "refund.succeeded";
  /** A payment for payment.* events, a refund (with payment_id) for refund.* events. */
  object: YooKassaPayment | YooKassaRefund;
}
