/**
 * Client IP for rate limits, trial anti-abuse and audit.
 *
 * The site sits behind Railway's edge proxy (Caddy) — NOT Cloudflare
 * (checked 15.09.2026: response headers `via: Caddy`, `x-railway-edge`).
 * So `cf-connecting-ip` is just a client header and must NOT be trusted:
 * a prod test showed six different forged values slipping past the
 * 5-per-minute limit on /api/auth/send-code. If Cloudflare is ever put in
 * front, trust `cf-connecting-ip` again ONLY together with rejecting
 * non-Cloudflare origins.
 *
 * `x-forwarded-for`: the client may send its own entries first; the proxy
 * appends the address it actually saw. So the RIGHTMOST public address is
 * the trustworthy one (internal/private hops of the platform are skipped).
 * If the proxy overwrites the header instead, there is one entry and the
 * rule gives the same answer. `x-real-ip` is the last fallback.
 *
 * Only syntactically valid addresses are returned; anything else → null,
 * so a junk header cannot mint an endless supply of rate-limit buckets.
 */

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:.]{2,45}$/i;

export function isValidIp(v: string): boolean {
  return IPV4.test(v) || (v.includes(":") && IPV6.test(v));
}

/** Private, loopback, link-local, CGNAT and unique-local ranges — platform hops, not clients. */
export function isPrivateIp(v: string): boolean {
  if (IPV4.test(v)) {
    const [a, b] = v.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const l = v.toLowerCase();
  return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
}

type HeaderSource = { get(name: string): string | null };

export function clientIpFrom(headers: HeaderSource): string | null {
  const xff = (headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(isValidIp);
  for (let i = xff.length - 1; i >= 0; i--) {
    if (!isPrivateIp(xff[i])) return xff[i];
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real && isValidIp(real)) return real;
  // Only private hops (local runs): the nearest one is still a stable key.
  return xff.length ? xff[xff.length - 1] : null;
}

/** Same, with a stable placeholder for rate-limit keys. */
export function clientIpKey(headers: HeaderSource): string {
  return clientIpFrom(headers) ?? "unknown";
}
