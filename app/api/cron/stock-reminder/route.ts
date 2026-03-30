import { NextResponse } from "next/server";
import { authorizeCronRequest, loadStockDigestEmail } from "@/app/api/cron/_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Send the stock digest via Resend (optional). Prefer /api/cron/stock-briefing + n8n Gmail if you
 * don’t use Resend.
 *
 * Env: CRON_SECRET, RESEND_API_KEY, STOCK_REMINDER_TO, optional RESEND_FROM, STOCK_DASHBOARD_URL.
 */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const toRaw = process.env.STOCK_REMINDER_TO?.trim();
  if (!resendKey || !toRaw) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason:
        "Set RESEND_API_KEY and STOCK_REMINDER_TO to send via Resend, or use GET /api/cron/stock-briefing with n8n + Gmail.",
    });
  }

  const { subject, text, html } = await loadStockDigestEmail();

  const from =
    process.env.RESEND_FROM?.trim() ||
    "Stock Dashboard <onboarding@resend.dev>";

  const to = toRaw.split(",").map((e) => e.trim()).filter(Boolean);

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!sendRes.ok) {
    const errBody = await sendRes.text();
    return NextResponse.json(
      { ok: false, status: sendRes.status, error: errBody },
      { status: 502 }
    );
  }

  const data = await sendRes.json().catch(() => ({}));
  return NextResponse.json({ ok: true, id: (data as { id?: string }).id });
}
