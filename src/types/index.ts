export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  createdAt: string;
  subscriptionEnd: string;
  vpnKey: string | null;
  xrayUuid: string | null;
  subToken: string | null;
  subId: string | null;
  telegramId: string | null;
  telegramLinked: boolean;
  referralCode: string;
  referrals: number;
  paidReferrals: number;
  balance: number;
}

export interface VerificationCode {
  email: string;
  code: string;
  expiresAt: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SubscriptionData {
  email: string;
  daysLeft: number;
  hoursLeft: number;
  minutesLeft: number;
  isExpired: boolean;
  subscriptionEnd: string;
  vpnKey: string | null;
  xrayUuid: string | null;
  subToken: string | null;
  telegramLinked: boolean;
  telegramLinkToken: string | null;
  referralCode: string;
  subscriptionPlan?: string;
  referrals: number;
  paidReferrals: number;
  balance: number;
  cashbackPercent: number;
  loyaltyTier: string;
  isAdmin?: boolean;
  // Remnawave-issued subscription (vpnKey carries the same link)
  subscriptionUrl?: string | null;
  /** Always null since Remnawave 3.x — kept for compatibility. */
  happCryptoLink?: string | null;
  trialUsedAt?: string | null;
  /** "panel_sync_pending" | "panel_sync_error" while a live subscription has no link yet. */
  provisioningError?: string | null;
  panelSyncState?: string | null;
  /** Which panel entity survived the Telegram link (bot | site | only-bot | only-site | none | adopted). */
  linkKept?: string | null;
  /**
   * Key 2 («Обход») from the DB — no panel call. `known`: the entity is
   * remembered; `maybe`: linked account, the bot's bypass not looked up
   * yet. Live numbers: GET /api/user/bypass (BypassLive).
   */
  bypassKey?: { known: boolean; maybe: boolean; subscriptionUrl: string | null; origin: "site" | "bot" | null };
  /** Gigabytes paid/granted but not yet credited in the panel, bytes. */
  bypassOwedBytes?: number;
}

/** GET /api/user/bypass — key 2 live. */
export interface BypassLive {
  state: "ok" | "none" | "unavailable";
  origin: "site" | "bot" | null;
  subscriptionUrl: string | null;
  limitBytes: number | null;
  usedBytes: number | null;
  remainingBytes: number | null;
  unlimited: boolean;
  status: string | null;
  owedBytes: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: "android" | "ios" | "windows" | "macos" | "tv";
  appName: string;
  downloadUrl: string;
  instructions: InstructionStep[];
}

export interface InstructionStep {
  step: number;
  title: string;
  description: string;
}

export interface XrayUserConfig {
  uuid: string;
  email: string;
  level: number;
  createdAt: string;
  expiresAt: string;
  trafficLimit: number | null;
  protocol: "vless" | "vmess" | "trojan";
  flow: string;
}

export interface XrayInboundClient {
  id: string;
  email: string;
  flow: string;
  level: number;
}

export interface XrayApiRequest {
  action: "add" | "remove" | "reset" | "list";
  user?: XrayUserConfig;
  uuid?: string;
}
