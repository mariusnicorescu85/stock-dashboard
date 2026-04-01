"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import AirtableBriefingTools from "@/app/briefing/AirtableBriefingTools";
import BriefingProductSignalButtons from "@/app/briefing/BriefingProductSignalButtons";
import {
  buildBuyingListCsv,
  buyingListCsvFilename,
  formatOrderByForCsv,
  type BuyingListRow,
} from "@/lib/buyingListCsv";
import {
  formatMoney,
  formatMoneyOptional,
  formatReorderTotalsEurUsd,
} from "@/lib/money";

export type { BuyingListRow };

const CRON_SECRET_STORAGE_KEY = "stock-dash-cron-secret";

const MAILTO_BODY_MAX = 1800;

export default function BuyingListClient({
  rows,
  shopLabel,
  dateLabel,
}: {
  rows: BuyingListRow[];
  shopLabel: string;
  dateLabel: string;
}) {
  const [qtyById, setQtyById] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.id] = r.qtyToOrder;
    return m;
  });

  const [smtpTo, setSmtpTo] = useState("");
  const [smtpMessage, setSmtpMessage] = useState<string | null>(null);
  const [smtpBusy, setSmtpBusy] = useState(false);

  const merged = useMemo(
    () => rows.map((r) => ({ ...r, qty: qtyById[r.id] ?? 0 })),
    [rows, qtyById]
  );

  const totalUnits = useMemo(
    () => merged.reduce((s, r) => s + Math.max(0, r.qty), 0),
    [merged]
  );

  const totalValueEur = useMemo(
    () =>
      merged.reduce((s, r) => {
        const q = Math.max(0, r.qty);
        if (r.purchaseCurrency !== "EUR") return s;
        if (r.pricePerUnit == null || !Number.isFinite(r.pricePerUnit)) return s;
        return s + q * r.pricePerUnit;
      }, 0),
    [merged]
  );

  const totalValueUsd = useMemo(
    () =>
      merged.reduce((s, r) => {
        const q = Math.max(0, r.qty);
        if (r.purchaseCurrency !== "USD") return s;
        if (r.pricePerUnit == null || !Number.isFinite(r.pricePerUnit)) return s;
        return s + q * r.pricePerUnit;
      }, 0),
    [merged]
  );

  const linesMissingPrice = useMemo(
    () =>
      merged.filter((r) => {
        const q = Math.max(0, r.qty);
        return q > 0 && (r.pricePerUnit == null || !Number.isFinite(r.pricePerUnit));
      }).length,
    [merged]
  );

  const setQty = useCallback((id: string, raw: string) => {
    const n = Number.parseInt(raw, 10);
    setQtyById((prev) => ({ ...prev, [id]: Number.isFinite(n) ? Math.max(0, n) : 0 }));
  }, []);

  const downloadCsvToFile = useCallback(
    (filename: string) => {
      const csv = buildBuyingListCsv(merged);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [merged]
  );

  const downloadCsv = useCallback(() => {
    downloadCsvToFile(buyingListCsvFilename(shopLabel));
  }, [downloadCsvToFile, shopLabel]);

  const smtpTextBody = useMemo(() => {
    const valueLine =
      totalValueEur > 0 || totalValueUsd > 0
        ? `\nKnown line value (supplier currency, not £): ${formatReorderTotalsEurUsd(totalValueEur, totalValueUsd)}` +
          (linesMissingPrice > 0 ? ` (${linesMissingPrice} line(s) missing unit price)` : "")
        : "";
    return (
      `Buying list for ${shopLabel}\n${dateLabel}\n\n` +
      `Total units: ${totalUnits}${valueLine}\n\n` +
      `Full line items are in the attached CSV (you can edit it and forward).`
    );
  }, [
    shopLabel,
    dateLabel,
    totalUnits,
    totalValueEur,
    totalValueUsd,
    linesMissingPrice,
  ]);

  const sendViaGmailSmtp = useCallback(async () => {
    setSmtpMessage(null);
    let secret = "";
    try {
      secret = sessionStorage.getItem(CRON_SECRET_STORAGE_KEY) ?? "";
    } catch {
      /* ignore */
    }
    if (!secret.trim()) {
      setSmtpMessage("Enter your cron secret above first (same as CRON_SECRET).");
      return;
    }

    const filename = buyingListCsvFilename(shopLabel);
    const csv = buildBuyingListCsv(merged);
    const subject = `Buying list — ${shopLabel} — ${dateLabel}`;

    setSmtpBusy(true);
    try {
      const res = await fetch("/api/buying-list/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret.trim()}`,
        },
        body: JSON.stringify({
          to: smtpTo.trim(),
          subject,
          textBody: smtpTextBody,
          csv,
          csvFilename: filename,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSmtpMessage(data.error || `Send failed (${res.status}).`);
        return;
      }
      setSmtpMessage("Sent. Check the recipient inbox (and spam).");
    } catch {
      setSmtpMessage("Network error — try again.");
    } finally {
      setSmtpBusy(false);
    }
  }, [merged, shopLabel, dateLabel, smtpTextBody, smtpTo]);

  const openGmailWithCsv = useCallback(() => {
    const filename = buyingListCsvFilename(shopLabel);
    downloadCsvToFile(filename);

    const valueLine =
      totalValueEur > 0 || totalValueUsd > 0
        ? `\nKnown line value (supplier currency, not £): ${formatReorderTotalsEurUsd(totalValueEur, totalValueUsd)}` +
          (linesMissingPrice > 0 ? ` (${linesMissingPrice} line(s) missing unit price)` : "")
        : "";
    const body =
      `Buying list for ${shopLabel}\n${dateLabel}\n\n` +
      `Total units: ${totalUnits}${valueLine}\n\n` +
      `A CSV of this order was just saved to your downloads as:\n${filename}\n\n` +
      `Attach that file to this email before sending. You can open it in Excel or Google Sheets to edit quantities first.`;
    const subject = `Buying list — ${shopLabel} — ${dateLabel}`;
    const gmailUrl =
      `https://mail.google.com/mail/?view=cm&fs=1` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  }, [
    downloadCsvToFile,
    shopLabel,
    dateLabel,
    totalUnits,
    totalValueEur,
    totalValueUsd,
    linesMissingPrice,
  ]);

  const mailtoHref = useMemo(() => {
    const subject = `Buying list — ${shopLabel} — ${dateLabel}`;
    const lines = merged.map((r, i) => {
      const q = Math.max(0, r.qty);
      const extra =
        r.pricePerUnit != null && Number.isFinite(r.pricePerUnit)
          ? ` · ${formatMoney(q * r.pricePerUnit, r.purchaseCurrency)} (${formatMoney(r.pricePerUnit, r.purchaseCurrency)} ea)`
          : "";
      return `${i + 1}. ${r.name} — ${q} units${extra} (order by ${formatOrderByForCsv(r.orderByDate)})`;
    });
    const valueLine =
      totalValueEur > 0 || totalValueUsd > 0
        ? `\nKnown line value (supplier currency, not £): ${formatReorderTotalsEurUsd(totalValueEur, totalValueUsd)}` +
          (linesMissingPrice > 0 ? ` (${linesMissingPrice} line(s) missing unit price)` : "")
        : "";
    let body = `Buying list for ${shopLabel}\n${dateLabel}\n\n${lines.join("\n")}\n\nTotal units: ${totalUnits}${valueLine}`;
    if (body.length > MAILTO_BODY_MAX) {
      body =
        `Buying list for ${shopLabel}\n${dateLabel}\n\n` +
        `${lines.slice(0, 12).join("\n")}\n\n` +
        `… and ${Math.max(0, lines.length - 12)} more lines (use Download CSV for the full list).\n\n` +
        `Total units (all lines): ${totalUnits}` +
          (totalValueEur > 0 || totalValueUsd > 0
            ? `\nKnown line value (supplier ccy): ${formatReorderTotalsEurUsd(totalValueEur, totalValueUsd)}`
            : "");
    }
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [merged, shopLabel, dateLabel, totalUnits, totalValueEur, totalValueUsd, linesMissingPrice]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
        Nothing on the buying list for this shop view. Try another shop or check the main dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AirtableBriefingTools variant="compact" />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          <span className="text-slate-200 font-medium tabular-nums">{merged.length}</span> product
          {merged.length !== 1 ? "s" : ""} ·{" "}
          <span className="text-emerald-200/90 font-semibold tabular-nums">{totalUnits}</span> total units
          (after edits)
          {totalValueEur > 0 || totalValueUsd > 0 ? (
            <>
              {" "}
              ·{" "}
              <span className="text-amber-100/90 font-semibold tabular-nums">
                {formatReorderTotalsEurUsd(totalValueEur, totalValueUsd)}
              </span>{" "}
              <span className="text-slate-500 font-normal">(not £)</span>
              {linesMissingPrice > 0 ? (
                <span className="text-slate-500 font-normal">
                  {" "}
                  (+{linesMissingPrice} without unit price)
                </span>
              ) : null}
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            className="h-10 inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-900/70 px-4 text-sm font-medium text-slate-100 hover:bg-slate-800/90"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={openGmailWithCsv}
            className="h-10 inline-flex items-center justify-center rounded-xl bg-emerald-500/90 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Draft in Gmail
          </button>
          <a
            href={mailtoHref}
            className="h-10 inline-flex items-center justify-center rounded-xl border border-slate-600/80 bg-slate-900/50 px-3 text-sm font-medium text-slate-300 hover:bg-slate-800/70"
          >
            Other mail app
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 px-4 py-3 space-y-2">
        <p className="text-xs text-slate-500">
          Send from server via Gmail SMTP (needs <span className="text-slate-400">GMAIL_USER</span> +{" "}
          <span className="text-slate-400">GMAIL_APP_PASSWORD</span> on Vercel / <span className="text-slate-400">.env.local</span>
          ). Uses the same cron secret as above.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="email"
            value={smtpTo}
            onChange={(e) => setSmtpTo(e.target.value)}
            placeholder="Recipient (optional if server sets BUYING_LIST_EMAIL_TO)"
            autoComplete="email"
            className="h-10 w-full sm:w-72 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
          <button
            type="button"
            disabled={smtpBusy}
            onClick={sendViaGmailSmtp}
            className="h-10 inline-flex items-center justify-center rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
          >
            {smtpBusy ? "Sending…" : "Email CSV (SMTP)"}
          </button>
        </div>
        {smtpMessage ? (
          <p
            className={`text-xs ${smtpMessage.startsWith("Sent.") ? "text-emerald-300/90" : "text-rose-300/90"}`}
          >
            {smtpMessage}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-[0_20px_70px_rgba(0,0,0,0.45)] overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/90 text-[11px] uppercase text-slate-400 border-b border-slate-800/60">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Brand</th>
              <th className="px-4 py-3 text-left">Order by</th>
              <th className="px-4 py-3 text-right w-32">Qty to order</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell w-28">Unit</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell w-28">Line</th>
              <th className="px-4 py-3 text-left w-[6.5rem] sm:w-[7rem]">Airtable</th>
              <th className="px-4 py-3 text-right hidden md:table-cell w-24">Link</th>
            </tr>
          </thead>
          <tbody>
            {merged.map((r) => (
              <tr
                key={r.id}
                className="border-t border-slate-900/60 odd:bg-slate-900/40 even:bg-slate-900/20"
              >
                <td className="px-4 py-3 text-slate-100 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{r.brand ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300 tabular-nums">{formatOrderByForCsv(r.orderByDate)}</td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={qtyById[r.id] ?? 0}
                    onChange={(e) => setQty(r.id, e.target.value)}
                    className="w-full max-w-[7rem] ml-auto rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-right tabular-nums text-emerald-200 font-semibold focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-400 hidden lg:table-cell">
                  {formatMoneyOptional(r.pricePerUnit, r.purchaseCurrency)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-200 font-medium hidden lg:table-cell">
                  {formatMoneyOptional(
                    r.pricePerUnit != null
                      ? Math.max(0, qtyById[r.id] ?? 0) * r.pricePerUnit
                      : null,
                    r.purchaseCurrency
                  )}
                </td>
                <td className="px-2 py-3 align-top">
                  <BriefingProductSignalButtons
                    row={{ id: r.id, name: r.name, airtableTable: r.airtableTable }}
                  />
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <Link href={`/product/${r.id}`} className="text-xs text-emerald-300/90 hover:underline">
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        “Draft in Gmail” downloads the CSV and opens a compose tab — attach the file from Downloads yourself. “Email
        CSV (SMTP)” sends from your configured Gmail account with the CSV attached. You can skip the recipient field
        if the server has <span className="text-slate-400">BUYING_LIST_EMAIL_TO</span> set. “Other mail app” uses your
        default client (long lists may be shortened; the CSV is always complete). Quantities here are for export /
        email only; they do not update Airtable. The <strong className="text-slate-400">Airtable</strong> column updates
        snooze / order dates (use the cron secret above).
      </p>
    </div>
  );
}
