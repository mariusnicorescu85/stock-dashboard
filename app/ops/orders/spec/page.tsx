import Link from "next/link";
import { NUVALEO_SPEC_MATRIX } from "@/lib/nuvaleoSpecMatrix";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  const t = status.toLowerCase();
  if (t === "done") return "bg-emerald-50 text-emerald-700 border-indigo-500/35";
  if (t === "partial") return "bg-amber-500/15 text-amber-700 border-amber-500/35";
  if (t.includes("configure")) return "bg-violet-500/15 text-violet-200 border-violet-500/35";
  return "bg-zinc-200/40 text-zinc-800 border-zinc-300";
}

export default function OpsOrdersSpecPage() {
  return (
    <main className="min-h-screen text-zinc-900">
      <div className="mx-auto max-w-[100rem] px-4 py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-600">Ops Control</p>
            <h1 className="text-3xl font-semibold leading-tight">Nuvaleo PDF v1.0 checklist</h1>
            <p className="text-sm text-zinc-500 max-w-3xl">
              PDF clause ↔ current implementation map for{" "}
              <span className="text-zinc-800">Automated Stock Ordering and Incoming Order Control Workflow</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/ops/orders"
              className="h-10 inline-flex items-center rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-800 hover:bg-zinc-100"
            >
              ← Order progress
            </Link>
            <Link
              href="/"
              className="h-10 inline-flex items-center rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-800 hover:bg-zinc-100"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-[72rem] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">PDF ref</th>
                <th className="px-4 py-3 font-medium">Requirement</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Implemented where</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {NUVALEO_SPEC_MATRIX.map((row) => (
                <tr key={row.pdfRef + row.requirement} className="hover:bg-zinc-200/30 align-top">
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-800 whitespace-nowrap">
                    {row.pdfRef}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-800 max-w-[32rem]">{row.requirement}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-lg border px-2 py-0.5 text-xs ${statusClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 max-w-[34rem]">{row.implementedWhere}</td>
                  <td className="px-4 py-2.5 text-zinc-500 max-w-[34rem]">{row.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-zinc-500 max-w-3xl">
          <span className="text-zinc-600">Full automation playbook</span> (Airtable views, n8n schedules,
          close-with-proof): repository file{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-zinc-800">docs/nuvaleo-full-automation.md</code>
          . Reminder API:{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-zinc-800">
            GET /api/cron/order-workflow-reminders
          </code>{" "}
          with Bearer <code className="text-zinc-600">CRON_SECRET</code>.
        </p>

        <p className="text-xs text-zinc-500">
          Keep this page updated as Airtable schemas, n8n automation, and gating rules mature.
        </p>
      </div>
    </main>
  );
}

