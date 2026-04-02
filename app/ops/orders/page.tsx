import Link from "next/link";
import { fetchOrderWorkflowProgressRows } from "@/lib/orderWorkflowProgress";

export const dynamic = "force-dynamic";

function fmtWhen(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string | null) {
  const t = (status ?? "").toLowerCase();
  if (t.includes("closed")) return "bg-slate-600/30 text-slate-200 border-slate-500/40";
  if (t.includes("delay")) return "bg-red-500/15 text-red-200 border-red-500/35";
  if (t.includes("sent") || t.includes("tracking") || t.includes("transit"))
    return "bg-sky-500/15 text-sky-200 border-sky-500/35";
  if (t.includes("draft") || t.includes("risk") || t.includes("generated"))
    return "bg-amber-500/15 text-amber-200 border-amber-500/35";
  if (t.includes("awaiting") || t.includes("upload")) return "bg-violet-500/15 text-violet-200 border-violet-500/35";
  if (t.includes("delivered") || t.includes("received")) return "bg-emerald-500/15 text-emerald-200 border-emerald-500/35";
  return "bg-slate-700/40 text-slate-200 border-slate-600/50";
}

export default async function OrderProgressPage() {
  const { rows, disabledReason, error } = await fetchOrderWorkflowProgressRows(200);

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[100rem] px-4 py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Ops Control</p>
            <h1 className="text-3xl font-semibold leading-tight">Order progress</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Supplier order workflows from Airtable—newest activity first. For teams without Airtable
              access; data is read-only here.
            </p>
            <p className="text-xs text-slate-500">{dateLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/buying-list"
              className="h-10 inline-flex items-center rounded-xl border border-slate-600 bg-slate-900/60 px-3 text-sm text-slate-200 hover:bg-slate-800/80"
            >
              Buying list
            </Link>
            <Link
              href="/"
              className="h-10 inline-flex items-center rounded-xl border border-slate-600 bg-slate-900/60 px-3 text-sm text-slate-200 hover:bg-slate-800/80"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {disabledReason && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {disabledReason}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!disabledReason && !error && rows.length === 0 && (
          <p className="text-sm text-slate-400">No order workflows found in Airtable yet.</p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <table className="min-w-[72rem] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Order ref</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th className="px-4 py-3 font-medium tabular-nums">Lines</th>
                  <th className="px-4 py-3 font-medium">Ccy</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Email sent</th>
                  <th className="px-4 py-3 font-medium">Send status</th>
                  <th className="px-4 py-3 font-medium">Tracking</th>
                  <th className="px-4 py-3 font-medium">ETA</th>
                  <th className="px-4 py-3 font-medium">Shipment</th>
                  <th className="px-4 py-3 font-medium">Risk date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-200">
                      {r.orderReference ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex max-w-[14rem] truncate rounded-lg border px-2 py-0.5 text-xs ${statusClass(
                          r.status
                        )}`}
                        title={r.status ?? ""}
                      >
                        {r.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-200">{r.supplierName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-300">{r.store ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-300">
                      {r.lineCount != null ? r.lineCount : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{r.currency ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400 max-w-[10rem] truncate" title={r.owner ?? ""}>
                      {r.owner ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fmtWhen(r.emailSentAt)}</td>
                    <td className="px-4 py-2.5 text-slate-400 max-w-[8rem] truncate" title={r.emailSendStatus ?? ""}>
                      {r.emailSendStatus ?? "—"}
                    </td>
                    <td
                      className="px-4 py-2.5 font-mono text-xs text-slate-300 max-w-[9rem] truncate"
                      title={r.trackingNumber ?? ""}
                    >
                      {r.trackingNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {fmtWhen(r.expectedDelivery)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 max-w-[8rem] truncate" title={r.shipmentStatus ?? ""}>
                      {r.shipmentStatus ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fmtWhen(r.triggerDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <p className="text-xs text-slate-500">
            Showing up to {rows.length} workflows (latest changes first). Full detail and edits stay in
            Airtable or your n8n tools.
          </p>
        )}
      </div>
    </main>
  );
}
