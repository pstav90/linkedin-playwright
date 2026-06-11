import { loadRuntimeConfig } from "./config.js";
import { GoogleSheetsClient } from "./googleSheets.js";
import { buildOutputs, writeOutputs } from "./pipeline.js";
import { writeSourceDiagnostics } from "./sourceDiagnostics.js";
import { sourceLinkedInJobs } from "./sources/linkedin.js";
import type { RawJob } from "./types.js";

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const sourcedJobs: RawJob[] = [];

  if (config.searches.linkedin.enabled) {
    console.log(`Sourcing LinkedIn jobs from ${config.searches.linkedin.queries.length} searches...`);
    const linkedinJobs = await sourceLinkedInJobs({
      queries: config.searches.linkedin.queries,
      maxJobsPerQuery: config.searches.linkedin.maxJobsPerQuery,
      headless: config.headless,
      searchLocation: config.linkedinSearchLocation,
      allowedLocations: config.linkedinAllowedLocations,
      pageDelayMinMs: config.linkedinPageDelayMinMs,
      pageDelayMaxMs: config.linkedinPageDelayMaxMs,
      searchScrollsMin: config.linkedinSearchScrollsMin,
      searchScrollsMax: config.linkedinSearchScrollsMax,
    });
    sourcedJobs.push(...linkedinJobs);
  }

  const { rawJobs, scoredJobs } = buildOutputs(sourcedJobs, config.candidateProfile);
  const reportJobs = scoredJobs.filter((job) => job.finalScore >= 75);

  writeOutputs(rawJobs, scoredJobs);
  writeSourceDiagnostics();

  console.log(`Found ${rawJobs.length} deduped roles.`);
  console.log(`Scored ${scoredJobs.length} roles; ${reportJobs.length} scored 75+.`);
  console.log("Wrote output/raw-jobs.json, output/scored-jobs.json, and output/daily-summary.md.");

  if (config.dryRun) {
    console.log("DRY_RUN=true, so Google Sheets was not modified.");
    return;
  }

  const sheets = new GoogleSheetsClient(config.googleSheetId);
  await sheets.ensureWorkbookSchema();
  const result = await sheets.upsertRoles(scoredJobs);
  console.log(`Updated Google Sheets: ${result.added} added, ${result.updated} updated.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
