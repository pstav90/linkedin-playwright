import { loadRuntimeConfig } from "./config.js";
import { buildOutputs, readRawJobs, readScoredJobs, writeOutputs } from "./pipeline.js";
import type { RawJob } from "./types.js";

function existingJobsAsRaw(): RawJob[] {
  try {
    return readRawJobs();
  } catch {
    return readScoredJobs();
  }
}

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const inputJobs = existingJobsAsRaw();
  const { rawJobs, scoredJobs } = buildOutputs(inputJobs, config.candidateProfile);
  writeOutputs(rawJobs, scoredJobs);
  console.log(`Reprocessed ${rawJobs.length} deduped roles from local output.`);
  console.log(`Wrote output/raw-jobs.json, output/scored-jobs.json, and output/daily-summary.md.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
