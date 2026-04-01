import type { CheckStatus, DiagnosticCheck, DiagnosticsReport } from "./diagnosticsTypes";

function overallFromChecks(checks: DiagnosticCheck[]): "ok" | "warn" | "fail" {
  if (checks.some((c) => c.status === "error")) return "fail";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "ok";
}

function push(
  checks: DiagnosticCheck[],
  id: string,
  order: number,
  title: string,
  description: string,
  status: CheckStatus,
  detail?: string
) {
  checks.push({ id, order, title, description, status, detail });
}

async function airtablePing(apiKey: string, baseId: string, tableName: string): Promise<{ ok: boolean; detail?: string }> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  let detail: string | undefined;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body?.error?.message || `HTTP ${res.status}`;
  } catch {
    detail = `HTTP ${res.status}`;
  }
  return { ok: false, detail };
}

/**
 * Runs ordered health checks without importing `airtable.ts` (which throws if core env is missing).
 */
export async function runDiagnostics(): Promise<DiagnosticsReport> {
  const started = Date.now();
  const startedAtIso = new Date(started).toISOString();
  const checks: DiagnosticCheck[] = [];
  let order = 0;

  const nextOrder = () => ++order;

  // --- Process / runtime ---
  push(
    checks,
    "runtime",
    nextOrder(),
    "Runtime",
    "Record Node.js version for support debugging.",
    "ok",
    `Node ${process.version}`
  );

  const isDev = process.env.NODE_ENV === "development";

  // --- Core Airtable env ---
  const apiKey = process.env.AIRTABLE_API_KEY?.trim() ?? "";
  const baseId = process.env.AIRTABLE_BASE_ID?.trim() ?? "";

  if (!apiKey) {
    push(
      checks,
      "env-airtable-key",
      nextOrder(),
      "Airtable API key",
      "Verify AIRTABLE_API_KEY is set (required for all product data).",
      "error",
      "Missing or empty AIRTABLE_API_KEY in environment."
    );
  } else {
    push(
      checks,
      "env-airtable-key",
      nextOrder(),
      "Airtable API key",
      "Verify AIRTABLE_API_KEY is set (required for all product data).",
      "ok",
      "Present."
    );
  }

  if (!baseId) {
    push(
      checks,
      "env-airtable-base",
      nextOrder(),
      "Airtable base",
      "Verify AIRTABLE_BASE_ID is set.",
      "error",
      "Missing or empty AIRTABLE_BASE_ID in environment."
    );
  } else {
    push(
      checks,
      "env-airtable-base",
      nextOrder(),
      "Airtable base",
      "Verify AIRTABLE_BASE_ID is set.",
      "ok",
      "Present."
    );
  }

  const productsTable = process.env.AIRTABLE_PRODUCTS_TABLE?.trim() || "Products";

  if (apiKey && baseId) {
    const liveOrder = nextOrder();
    const ping = await airtablePing(apiKey, baseId, productsTable);
    push(
      checks,
      "airtable-live",
      liveOrder,
      "Airtable API reachability",
      `Request first page of the "${productsTable}" table (max 1 row).`,
      ping.ok ? "ok" : "error",
      ping.ok ? "Airtable responded successfully." : ping.detail || "Request failed."
    );
  } else {
    push(
      checks,
      "airtable-live",
      nextOrder(),
      "Airtable API reachability",
      `Skipped live request (missing API key or base ID).`,
      "error",
      "Cannot call Airtable without credentials."
    );
  }

  // --- Optional: OpenAI ---
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) {
    const vercelHint = process.env.VERCEL
      ? ` Vercel: enable OPENAI_API_KEY for the environment of this URL (Production vs Preview vs Development), then redeploy — new vars are not picked up until a deployment runs with them.`
      : "";
    push(
      checks,
      "openai",
      nextOrder(),
      "OpenAI (briefing / narration)",
      "Optional: OPENAI_API_KEY enables AI narration features.",
      "warn",
      `Not set — briefing narration will not call OpenAI.${vercelHint}`
    );
  } else {
    push(
      checks,
      "openai",
      nextOrder(),
      "OpenAI (briefing / narration)",
      "Optional: OPENAI_API_KEY enables AI narration features.",
      "ok",
      process.env.VERCEL && process.env.VERCEL_ENV
        ? `Present (Vercel: ${process.env.VERCEL_ENV}).`
        : "Present."
    );
  }

  // --- Cron & email ---
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    push(
      checks,
      "cron-secret",
      nextOrder(),
      "Cron authorization",
      "CRON_SECRET protects /api/cron/* routes.",
      isDev ? "warn" : "error",
      isDev
        ? "Not set — cron routes reject requests until you set CRON_SECRET."
        : "Not set in production — scheduled jobs cannot authenticate."
    );
  } else {
    push(
      checks,
      "cron-secret",
      nextOrder(),
      "Cron authorization",
      "CRON_SECRET protects /api/cron/* routes.",
      "ok",
      "Present."
    );
  }

  const siteUrl = process.env.STOCK_DASHBOARD_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!siteUrl && !vercelUrl) {
    push(
      checks,
      "public-url",
      nextOrder(),
      "Public dashboard URL",
      "STOCK_DASHBOARD_URL (or VERCEL_URL on Vercel) is used in cron emails.",
      isDev ? "ok" : "warn",
      isDev
        ? "Local dev — OK to rely on localhost for testing."
        : "Neither STOCK_DASHBOARD_URL nor VERCEL_URL set — link targets in emails may be wrong."
    );
  } else {
    push(
      checks,
      "public-url",
      nextOrder(),
      "Public dashboard URL",
      "STOCK_DASHBOARD_URL (or VERCEL_URL on Vercel) is used in cron emails.",
      "ok",
      siteUrl ? `STOCK_DASHBOARD_URL is set.` : `Using VERCEL_URL for previews.`
    );
  }

  checks.sort((a, b) => a.order - b.order);

  const finished = Date.now();
  const overall = overallFromChecks(checks);
  const summary =
    overall === "ok"
      ? "All checks passed — system configuration looks healthy."
      : overall === "warn"
        ? "Some optional or contextual items need attention."
        : "One or more checks failed — fix errors before relying on production jobs.";

  return {
    startedAtIso,
    finishedAtIso: new Date(finished).toISOString(),
    durationMs: finished - started,
    overall,
    summary,
    checks,
  };
}
