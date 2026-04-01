export type CheckStatus = "ok" | "warn" | "error";

export type DiagnosticCheck = {
  id: string;
  order: number;
  title: string;
  description: string;
  status: CheckStatus;
  detail?: string;
};

export type DiagnosticsReport = {
  startedAtIso: string;
  finishedAtIso: string;
  durationMs: number;
  overall: "ok" | "warn" | "fail";
  summary: string;
  checks: DiagnosticCheck[];
};
