import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

type DiagnosticEvent = {
  stage: "extracted" | "hydrated" | "accepted" | "rejected" | "failed_hydration";
  reason?: string;
  company?: string;
  title?: string;
  location?: string;
  url?: string;
  source?: string;
};

const events: DiagnosticEvent[] = [];

export function recordSourceDiagnostic(event: DiagnosticEvent): void {
  events.push(event);
}

export function writeSourceDiagnostics(outputDir = "output"): void {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "source-diagnostics.json"), `${JSON.stringify(events, null, 2)}\n`);
}
