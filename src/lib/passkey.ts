import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { pool } from "./db";
import { v4 as uuidv4 } from "uuid";

const RP_NAME = "Atlas Secure";
// Прод — qodev.dev (atlassecure.uk — другой, старый сайт): с чужим RP ID
// браузер отказывает в создании ключа входа.
const RP_ID = process.env.PASSKEY_RP_ID || "qodev.dev";
const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || `https://${RP_ID}`;

// ─── Challenge store ────────────────────────────────────────────

const challengeStore = new Map<string, { challenge: string; exp: number }>();

function saveChallenge(key: string, challenge: string) {
  challengeStore.set(key, { challenge, exp: Date.now() + 300_000 });
}

function popChallenge(key: string): string | null {
  const e = challengeStore.get(key);
  challengeStore.delete(key);
  if (!e || Date.now() > e.exp) return null;
  return e.challenge;
}

// Cleanup every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of challengeStore) if (now > v.exp) challengeStore.delete(k);
  }, 60_000);
}

// ─── DB helpers ─────────────────────────────────────────────────

async function getUserCreds(userId: string) {
  const r = await pool.query(
    "SELECT id, credential_id, public_key, counter, transports FROM passkey_credentials WHERE user_id = $1", [userId]
  );
  return r.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    credentialId: row.credential_id as string,
    publicKey: row.public_key as string,
    counter: Number(row.counter),
    transports: row.transports as string | null,
  }));
}

async function getCredById(credId: string) {
  const r = await pool.query(
    "SELECT id, user_id, credential_id, public_key, counter, transports FROM passkey_credentials WHERE credential_id = $1", [credId]
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    id: row.id as string,
    userId: row.user_id as string,
    credentialId: row.credential_id as string,
    publicKey: row.public_key as string,
    counter: Number(row.counter),
    transports: row.transports as string | null,
  };
}

export async function userHasPasskey(userId: string): Promise<boolean> {
  const r = await pool.query("SELECT 1 FROM passkey_credentials WHERE user_id = $1 LIMIT 1", [userId]);
  return r.rows.length > 0;
}

// ─── Registration ───────────────────────────────────────────────

export async function generatePasskeyRegistration(userId: string, email: string) {
  const existing = await getUserCreds(userId);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? c.transports.split(",") as AuthenticatorTransportFuture[] : undefined,
    })),
    // "required", а не "preferred" (аудит безопасности 19.09.2026):
    // "preferred" — пожелание, и ключ вправе его не выполнить. Тогда
    // сам факт «устройство у меня в руках» становился полным входом
    // в аккаунт, без отпечатка, лица или кода блокировки.
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  saveChallenge(`reg:${userId}`, options.challenge);
  return options;
}

export async function verifyPasskeyRegistration(userId: string, response: RegistrationResponseJSON) {
  const challenge = popChallenge(`reg:${userId}`);
  if (!challenge) throw new Error("Challenge expired");

  const v = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    // Проверяем, а не просим: без этого ключ, не спросивший отпечаток
    // или код блокировки, всё равно принимался (аудит 19.09.2026).
    requireUserVerification: true,
  });

  if (!v.verified || !v.registrationInfo) throw new Error("Failed");

  const cred = v.registrationInfo.credential;
  await pool.query(
    `INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, counter, transports) VALUES ($1,$2,$3,$4,$5,$6)`,
    [uuidv4(), userId, cred.id, Buffer.from(cred.publicKey).toString("base64"), cred.counter, cred.transports?.join(",") || null]
  );
  return { verified: true };
}

// ─── Authentication ─────────────────────────────────────────────

export async function generatePasskeyAuthentication() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
  });
  saveChallenge(`auth:${options.challenge}`, options.challenge);
  return options;
}

export async function verifyPasskeyAuthentication(response: AuthenticationResponseJSON): Promise<{ verified: boolean; userId: string | null }> {
  const cred = await getCredById(response.id);
  if (!cred) return { verified: false, userId: null };

  // Extract challenge from client response to find our stored one
  let clientChallenge: string;
  try {
    const raw = Buffer.from(response.response.clientDataJSON, "base64url").toString("utf-8");
    clientChallenge = JSON.parse(raw).challenge;
  } catch {
    return { verified: false, userId: null };
  }

  const challenge = popChallenge(`auth:${clientChallenge}`);
  if (!challenge) return { verified: false, userId: null };

  try {
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, "base64"),
        counter: cred.counter,
        transports: cred.transports ? cred.transports.split(",") as AuthenticatorTransportFuture[] : undefined,
      },
      requireUserVerification: true,
    });

    if (v.verified) {
      await pool.query("UPDATE passkey_credentials SET counter = $1 WHERE id = $2", [v.authenticationInfo.newCounter, cred.id]);
      return { verified: true, userId: cred.userId };
    }
  } catch (err) {
    console.error("[PASSKEY] Verify error:", err);
  }

  return { verified: false, userId: null };
}
