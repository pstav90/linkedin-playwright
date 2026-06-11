import crypto from "node:crypto";
import type { RawJob, ScoredJob } from "./types.js";

export function normalizeKeyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function roleDedupeKey(job: Pick<RawJob, "company" | "title" | "url">): string {
  return [job.company, job.title, job.url].map(normalizeKeyPart).join(" | ");
}

export function roleIdFor(job: Pick<RawJob, "company" | "title" | "url">): string {
  return crypto.createHash("sha256").update(roleDedupeKey(job)).digest("hex").slice(0, 12);
}

export function dedupeRawJobs(jobs: RawJob[]): RawJob[] {
  const seen = new Set<string>();
  const deduped: RawJob[] = [];

  for (const job of jobs) {
    const key = roleDedupeKey(job);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(job);
  }

  return deduped;
}

export function dedupeScoredJobs(jobs: ScoredJob[]): ScoredJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = roleDedupeKey(job);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
