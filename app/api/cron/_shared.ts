import { fetchProducts } from "@/lib/airtable";
import { briefingEmailText, buildStockBriefing, type StockBriefing } from "@/lib/stockBriefing";

export function authorizeCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization")?.trim();
  return auth === `Bearer ${secret}`;
}

export function dashboardBaseUrl(): string {
  const site = process.env.STOCK_DASHBOARD_URL?.trim();
  if (site) return site.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export type StockDigestPayload = {
  briefing: StockBriefing;
  dashboardUrl: string;
  subject: string;
  text: string;
  html: string;
};

/** Loads products, builds briefing, and renders email subject/body (HTML + plain text). */
export async function loadStockDigestEmail(): Promise<StockDigestPayload> {
  const products = await fetchProducts();
  const briefing = buildStockBriefing(products);
  const base = dashboardBaseUrl();
  const dashboardUrl = `${base}/`;
  const { subject, text, html } = briefingEmailText(briefing, dashboardUrl);
  return { briefing, dashboardUrl, subject, text, html };
}
