import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { pool } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";
import { sendContactRequestEmail } from "@/lib/email";
import { SUPPORT_DESK } from "@/lib/contacts";
import { sendPushToAdmin } from "@/lib/push";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

const MAX_LEN = { name: 200, email: 254, interest: 64, message: 5000 };

export async function POST(request: NextRequest) {
  try {
    // Public form that writes to the DB and notifies the admin: cap per IP.
    const limit = checkRateLimit(`contact:${clientIpKey(request.headers)}`, 5, 10 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком много заявок. Повторите через ${limit.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, interest, message } = body ?? {};

    if (
      typeof name !== "string" || typeof email !== "string" || typeof interest !== "string" ||
      !name.trim() || !email.trim() || !interest.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "Name, email and interest are required" },
        { status: 400 }
      );
    }
    if (message != null && typeof message !== "string") {
      return NextResponse.json({ success: false, error: "Invalid message" }, { status: 400 });
    }
    if (
      name.length > MAX_LEN.name || email.length > MAX_LEN.email || interest.length > MAX_LEN.interest ||
      (typeof message === "string" && message.length > MAX_LEN.message)
    ) {
      return NextResponse.json({ success: false, error: "Field too long" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO contact_requests (id, name, email, interest, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, name.trim(), email.trim().toLowerCase(), interest, message?.trim() || null]
    );

    // Find admin user by ADMIN_EMAIL and send notification to their user_id
    const adminResult = await pool.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [ADMIN_EMAIL]
    );
    const adminUserId = adminResult.rows[0]?.id;

    // Письмо в поддержку — главный сигнал (владелец, 19.09.2026).
    // Падение почты не должно ронять заявку: строка в базе уже есть, и
    // человеку важнее, что она сохранилась, чем наш внутренний канал.
    try {
      await sendContactRequestEmail({
        to: SUPPORT_DESK.email,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        interest,
        message: message?.trim() || null,
        id,
      });
    } catch (err) {
      console.error("[CONTACT] notification email failed:", err);
    }

    if (adminUserId) {
      const notifId = uuidv4();
      const title = "New request: " + interest.toUpperCase();
      const notifMsg = [
        `Name: ${name}`,
        `Email: ${email}`,
        `Interest: ${interest}`,
        message ? `Message: ${message.slice(0, 200)}` : null,
      ].filter(Boolean).join("\n");

      await pool.query(
        `INSERT INTO notifications (id, title, message, target) VALUES ($1, $2, $3, $4)`,
        [notifId, title, notifMsg, adminUserId]
      );
    }

    // Push в установленное приложение админа — тот же сигнал, что у
    // откликов на вакансии: письмо можно увидеть не сразу.
    try {
      await sendPushToAdmin(`Заявка: ${interest}`, `${name} · ${email}`, "/admin?tab=inbox");
    } catch (err) {
      console.error("[CONTACT] admin push failed:", err);
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Contact request error:", error);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
