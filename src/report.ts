import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ScoredJob } from "./types.js";

function formatShortDate(date = new Date()): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function stripBoldMarkers(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
}

function markdownEscape(value: string): string {
  return stripBoldMarkers(value).replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function roleRow(job: ScoredJob): string {
  return [
    markdownEscape(job.company),
    `[${markdownEscape(job.title)}](${job.url})`,
    markdownEscape(job.location),
    String(job.finalScore),
    markdownEscape(job.classification),
    markdownEscape(job.jdSynopsis),
    markdownEscape(job.scoreRationale),
    markdownEscape(job.recommendedAction),
    markdownEscape(job.resumeAngle),
    markdownEscape(job.outreachAngle),
  ].join(" | ");
}

export function buildDailySummary(jobs: ScoredJob[]): string {
  const pursue = jobs
    .filter((job) => job.finalScore >= 90)
    .sort((a, b) => b.finalScore - a.finalScore);
  const highPotential = jobs
    .filter((job) => job.finalScore >= 75 && job.finalScore < 90)
    .sort((a, b) => b.finalScore - a.finalScore);
  const generatedAt = formatShortDate();
  const header =
    "| Company | Role | Location | Effective Score | Final Bucket | JD Synopsis | Score Rationale | Recommended Action | Resume Angle | Outreach Angle |\n" +
    "| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |";

  const section = (title: string, rows: ScoredJob[]) => {
    if (rows.length === 0) return `## ${title}\n\nNo roles in this bucket today.`;
    return `## ${title}\n\n${header}\n${rows.map(roleRow).join("\n")}`;
  };

  return [
    "# Daily Career Agent Summary",
    "",
    `Generated: ${generatedAt}`,
    "",
    section("Pursue", pursue),
    "",
    section("Potential", highPotential),
    "",
  ].join("\n");
}

export function writeDailySummary(jobs: ScoredJob[], outputDir = "output"): string {
  mkdirSync(outputDir, { recursive: true });
  const summary = buildDailySummary(jobs);
  const filePath = path.join(outputDir, "daily-summary.md");
  writeFileSync(filePath, summary);
  return filePath;
}
