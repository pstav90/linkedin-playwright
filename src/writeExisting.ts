import { loadRuntimeConfig } from "./config.js";
import { GoogleSheetsClient } from "./googleSheets.js";
import { readScoredJobs } from "./pipeline.js";

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const scoredJobs = readScoredJobs();
  const sheets = new GoogleSheetsClient(config.googleSheetId);
  await sheets.ensureWorkbookSchema();
  const result = await sheets.upsertRoles(scoredJobs);
  console.log(`Wrote existing scored output to Google Sheets: ${result.added} added, ${result.updated} updated.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
