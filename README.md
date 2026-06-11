# career-agent

`career-agent` is a local TypeScript job-search pipeline that sources roles from LinkedIn with Playwright, scores them against a configurable candidate profile, writes reviewable local output, and can sync reviewed roles into a Google Sheet CRM.

It is designed to be edited and extended by Codex, Claude Code, Cloud Code, or a human developer while keeping credentials, browser sessions, and personal data out of GitHub.

## What It Does

- Opens LinkedIn job searches or LinkedIn job collection links in a local Playwright Chromium profile.
- Lets you log into LinkedIn manually once, then reuses `./browser-profile` locally.
- Extracts job title, company, location, LinkedIn URL, source, and job description text when visible.
- Filters LinkedIn results by allowed locations, such as remote or a specific metro area.
- Dedupes roles by normalized company, title, and URL.
- Scores roles on a 100-point scale using your local candidate profile.
- Produces local review artifacts in `output/`.
- Writes to Google Sheets only when `DRY_RUN=false`.
- Preserves manual edits in the CRM when updating existing rows.

## What It Does Not Do

- It does not auto-apply to jobs.
- It does not auto-message anyone.
- It does not scrape LinkedIn contacts or private relationship graphs.
- It does not write to `Contacts`, `Warm Paths`, or `Interactions`.
- It does not commit LinkedIn cookies, browser profiles, Google credentials, `.env` files, local configs, or real output files.
- It does not source from company career pages in V1.

## Quick Start

```bash
npm run setup
cp .env.example .env.local
cp config/candidate-profile.example.json config/candidate-profile.local.json
cp config/searches.example.json config/searches.local.json
```

Edit `.env.local`:

```bash
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.local.json
DRY_RUN=true
HEADLESS=false
LINKEDIN_SEARCH_LOCATION=San Francisco Bay Area
LINKEDIN_ALLOWED_LOCATIONS=remote,san francisco,san francisco bay area,bay area,oakland,berkeley,emeryville,south san francisco,daly city,san mateo,redwood city,menlo park,palo alto,mountain view,sunnyvale,cupertino,santa clara,san jose,fremont,san ramon,pleasanton
```

Then edit:

- `config/candidate-profile.local.json`
- `config/searches.local.json`

## LinkedIn Login

Run this once:

```bash
npm run linkedin:login
```

A Playwright Chromium window opens using `./browser-profile`. Log into LinkedIn manually. That browser profile stays local and is ignored by Git.

## First Dry Run

```bash
DRY_RUN=true HEADLESS=false npm run start
```

Review:

- `output/raw-jobs.json`
- `output/scored-jobs.json`
- `output/daily-summary.md`
- `output/source-diagnostics.json`

Dry runs do not modify Google Sheets.

## First Sheet Write

After reviewing local output:

```bash
DRY_RUN=false HEADLESS=false npm run start
```

When `DRY_RUN=false`, the app creates or repairs the managed Google Sheet tabs and then appends or updates roles in `Roles`.

## One-Off LinkedIn Link

Run a single LinkedIn job search or collection URL instead of the configured searches:

```bash
DRY_RUN=true HEADLESS=false LINK="https://www.linkedin.com/jobs/collections/recommended/?currentJobId=0000000000" LINK_NAME="LinkedIn recommended jobs" npm run start
```

For a real write:

```bash
DRY_RUN=false HEADLESS=false LINK="https://www.linkedin.com/jobs/collections/recommended/?currentJobId=0000000000" LINK_NAME="LinkedIn recommended jobs" npm run start
```

When `LINK` is present, the app ignores `config/searches.local.json` and uses only that URL.

## Google Sheets

Share your CRM spreadsheet with the Google service account email. The app manages only these tabs:

- `Roles`
- `Companies`
- `Interview Prep`

These tabs are user-managed and protected from automated writes:

- `Contacts`
- `Warm Paths`
- `Interactions`

The main write target is `Roles`. Its visible columns are:

```text
Date Found
Company
Role Title
Level
Status
Notes
Final Bucket
Agent Score
Manual Score Override
Fit Score
Financial Upside Score
Compensation Score
Scope Score
Prestige Score
Access Score
Score Rationale
Last Updated
Source
```

`Role Title` is written as a clickable Google Sheets hyperlink. `Final Bucket` is a live formula that uses `Manual Score Override` when present, otherwise `Agent Score`.

Existing role rows preserve:

- `Manual Score Override`
- `Status`
- `Notes`
- manually edited `Access Score`

## Commands

```bash
npm run setup          # install dependencies and Playwright Chromium
npm run linkedin:login # open the local LinkedIn browser profile
npm run start          # run with current environment settings
npm run dry-run        # force DRY_RUN=true
npm run write          # force DRY_RUN=false
npm run reprocess      # rescore existing output/raw-jobs.json without opening LinkedIn
npm run write:existing # write existing output/scored-jobs.json to Google Sheets
npm run typecheck      # TypeScript check
```

## GitHub Safety

Before publishing, verify these files are not committed:

- `.env`
- `.env.local`
- Google service account JSON files
- `browser-profile/`
- `.playwright/`
- `output/*.json`
- `output/*.md`
- `data/*.csv`
- `data/*.json`
- `config/*.local.json`

The repo includes `.gitignore` rules for these paths. Commit only safe examples.

## Docs

- [Setup](docs/SETUP.md)
- [LinkedIn Usage](docs/LINKEDIN.md)
- [Google Sheet Schema](docs/SHEET_SCHEMA.md)
- [Scoring](docs/SCORING.md)
- [Extending](docs/EXTENDING.md)
- [Agent Instructions](AGENTS.md)

## Public V1 Scope

V1 is intentionally narrow: LinkedIn job sourcing, local scoring, local review output, and optional Google Sheets sync. Relationship mapping, contact importers, automated outreach, company enrichment, and non-LinkedIn job sources are out of scope until they can be added as explicit, opt-in workflows.
