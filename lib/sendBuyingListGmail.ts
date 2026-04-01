import nodemailer from "nodemailer";

/**
 * Sends mail via Gmail SMTP using GMAIL_USER + GMAIL_APP_PASSWORD (Google account app password).
 */
export async function sendBuyingListViaGmailSMTP(opts: {
  to: string;
  subject: string;
  text: string;
  csvBody: string;
  filename: string;
}) {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Stock dashboard" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    attachments: [
      {
        filename: opts.filename,
        content: opts.csvBody,
        contentType: "text/csv; charset=utf-8",
      },
    ],
  });
}
