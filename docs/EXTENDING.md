# Extending

Public V1 is scoped to LinkedIn job sourcing. The safest way to extend it is to keep the pipeline boundaries stable.

## Current Pipeline

```text
LinkedIn source -> RawJob -> JD enrichment -> dedupe -> scoring -> report/output -> optional Google Sheets write
```

## Important Files

- `src/sources/linkedin.ts`: LinkedIn browser sourcing and JD hydration.
- `src/jobParsing.ts`: cleanup and JD synopsis extraction.
- `src/dedupe.ts`: role keys and duplicate handling.
- `src/scoring.ts`: score calculation and recommendation text.
- `src/report.ts`: daily markdown report.
- `src/googleSheets.ts`: Google Sheets read/write logic.
- `src/schemas.ts`: sheet headers and protected tab lists.
- `src/run.ts`: main CLI flow.

## Add or Tune Searches

Prefer editing `config/searches.local.json` instead of code.

## Tune Candidate Fit

Prefer editing `config/candidate-profile.local.json` instead of code.

## Add New Scoring Signals

Update `src/scoring.ts`. Keep the total score bounded at 100 and update `docs/SCORING.md` if weights change.

## Add New Sheet Columns

Update:

- `src/schemas.ts`
- `src/googleSheets.ts`
- `docs/SHEET_SCHEMA.md`
- `README.md`

Preserve manual fields unless the user explicitly asks otherwise.

## Add New Sources

Non-LinkedIn sources are out of scope for public V1. If you add one locally, make it return `RawJob[]` and keep credentials/session data out of source code.

## Safety Rules

- Do not hardcode spreadsheet IDs.
- Do not hardcode credentials.
- Do not commit `.env`, service account JSON, browser profiles, output files, or local configs.
- Do not automate applying or messaging.
- Do not scrape private contacts or relationship graphs.
- Default to `DRY_RUN=true` when testing.
