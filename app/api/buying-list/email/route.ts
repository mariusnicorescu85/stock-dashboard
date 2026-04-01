import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/app/api/cron/_shared";
import { sendBuyingListViaGmailSMTP } from "@/lib/sendBuyingListGmail";

const MAX_CSV_BYTES = 3 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const envDefaultTo = process.env.BUYING_LIST_EMAIL_TO?.trim();
  const toRaw = typeof b.to === "string" ? b.to.trim() : "";
  const to = toRaw || envDefaultTo || "";

  if (!to || !EMAIL_RE.test(to)) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid "to" address. Set it in the form or set BUYING_LIST_EMAIL_TO in the server environment.',
      },
      { status: 400 }
    );
  }

  const csv = typeof b.csv === "string" ? b.csv : "";
  if (!csv) {
    return NextResponse.json({ error: "Missing csv" }, { status: 400 });
  }

  const csvBytes = Buffer.byteLength(csv, "utf8");
  if (csvBytes > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "CSV too large" }, { status: 400 });
  }

  let csvFilename =
    typeof b.csvFilename === "string" ? b.csvFilename.trim() : "buying-list.csv";
  csvFilename = csvFilename.replace(/[/\\]/g, "").slice(0, 180);
  if (!csvFilename.toLowerCase().endsWith(".csv")) {
    csvFilename = "buying-list.csv";
  }

  const subject =
    typeof b.subject === "string" && b.subject.trim()
      ? b.subject.trim().slice(0, 200)
      : "Buying list";

  const textBody =
    typeof b.textBody === "string" && b.textBody.trim()
      ? b.textBody.trim()
      : "Buying list is attached as CSV.";

  try {
    await sendBuyingListViaGmailSMTP({
      to,
      subject,
      text: textBody,
      csvBody: csv,
      filename: csvFilename,
    });
  } catch (e) {
    console.error("sendBuyingListViaGmailSMTP:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
