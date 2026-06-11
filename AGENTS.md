# Agent Instructions

This repo is intended to be safe to publish and safe to edit with coding agents.

## Scope

Public V1 sources jobs from LinkedIn only, scores them locally, writes local output, and can sync reviewed roles to Google Sheets.

Do not add company career-page sourcing, contact scraping, warm-path scraping, auto-apply, or auto-message behavior unless the user explicitly asks for a new opt-in workflow.

## Safety

Never commit or hardcode:

- Google Sheet IDs
- service account JSON
- API keys
- `.env` or `.env.local`
- LinkedIn cookies or session data
- `browser-profile/`
- real output files from `output/`
- imported data files from `data/`
- `config/*.local.json`

Use example files only for committed defaults.

## Google Sheets

Managed tabs:

- `Roles`
- `Companies`
- `Interview Prep`

Protected user-managed tabs:

- `Contacts`
- `Warm Paths`
- `Interactions`

Do not create, repair, clear, append, or update protected tabs.

For existing role rows, preserve:

- `Manual Score Override`
- `Status`
- `Notes`
- manually edited `Access Score`

## Development

Use:

```bash
npm run typecheck
```

Prefer `DRY_RUN=true` for behavior testing:

```bash
DRY_RUN=true HEADLESS=false npm run start
```

Do not run destructive cleanup commands against user files. If removing local artifacts for publication, verify they are ignored by `.gitignore` first.

## Config

Users should customize:

- `config/candidate-profile.local.json`
- `config/searches.local.json`
- `.env.local`

Avoid changing source code for ordinary search/profile customization.
