import Link from "next/link";
import { notFound } from "next/navigation";
import { runDiagnostics } from "@/lib/diagnosticsRun";
import { DiagnosticsView } from "./DiagnosticsView";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  if (process.env.DIAGNOSTICS_DISABLED === "1" || process.env.DIAGNOSTICS_DISABLED === "true") {
    notFound();
  }

  const report = await runDiagnostics();

  return (
    <main className="min-h-screen text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-600">Diagnostics</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold leading-tight">System health</h1>
              <p className="mt-2 text-sm text-zinc-500 max-w-xl">
                Server-side checks for environment variables, integrations, and a live Airtable
                request. Nothing secret is sent to the browser — only pass/fail and short messages.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              ← Back to dashboard
            </Link>
          </div>
        </header>

        <DiagnosticsView report={report} />
      </div>
    </main>
  );
}
