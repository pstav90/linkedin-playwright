import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dedupeRawJobs, dedupeScoredJobs } from "./dedupe.js";
import { enrichJobFromJd } from "./jobParsing.js";
import { writeDailySummary } from "./report.js";
import { scoreJobs } from "./scoring.js";
import { RawJobSchema, ScoredJobSchema, type CandidateProfile, type RawJob, type ScoredJob } from "./types.js";

export function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function buildOutputs(jobs: RawJob[], candidateProfile: CandidateProfile): { rawJobs: RawJob[]; scoredJobs: ScoredJob[] } {
  const rawJobs = dedupeRawJobs(jobs.map(enrichJobFromJd));
  const scoredJobs = dedupeScoredJobs(scoreJobs(rawJobs, candidateProfile)).sort((a, b) => b.finalScore - a.finalScore);
  return { rawJobs, scoredJobs };
}

export function writeOutputs(rawJobs: RawJob[], scoredJobs: ScoredJob[], outputDir = path.resolve("output")): void {
  mkdirSync(outputDir, { recursive: true });
  writeJson(path.join(outputDir, "raw-jobs.json"), rawJobs);
  writeJson(path.join(outputDir, "scored-jobs.json"), scoredJobs);
  writeDailySummary(scoredJobs.filter((job) => job.finalScore >= 75), outputDir);
}

export function readRawJobs(filePath = path.resolve("output/raw-jobs.json")): RawJob[] {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  return RawJobSchema.array().parse(parsed);
}

export function readScoredJobs(filePath = path.resolve("output/scored-jobs.json")): ScoredJob[] {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  return ScoredJobSchema.array().parse(parsed);
}
