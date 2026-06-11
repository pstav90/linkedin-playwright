# Setup

## Requirements

- Node.js 20+
- A Google account
- A Google Sheet to use as the CRM
- A Google Cloud service account with Google Sheets API access
- A LinkedIn account you can log into manually in the local browser profile

## Install

```bash
npm run setup
cp .env.example .env.local
cp config/candidate-profile.example.json config/candidate-profile.local.json
cp config/searches.example.json config/searches.local.json
```

## Google Sheets API

1. Create or choose a Google Cloud project.
2. Enable the Google Sheets API.
3. Create a service account.
4. Download the service account JSON file to a local path outside the repo, or use an ignored filename such as `service-account.local.json`.
5. Share your CRM Google Sheet with the service account email.
6. Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute JSON path.
7. Set `GOOGLE_SHEET_ID` to your spreadsheet ID.

Do not commit service account JSON files or `.env` files.

## Environment

Edit `.env.local`:

```bash
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.local.json
DRY_RUN=true
HEADLESS=false
LINKEDIN_SEARCH_LOCATION=San Francisco Bay Area
LINKEDIN_ALLOWED_LOCATIONS=remote,san francisco,san francisco bay area,bay area,oakland,berkeley,emeryville,south san francisco,daly city,san mateo,redwood city,menlo park,palo alto,mountain view,sunnyvale,cupertino,santa clara,san jose,fremont,san ramon,pleasanton
LINKEDIN_PAGE_DELAY_MIN_MS=3000
LINKEDIN_PAGE_DELAY_MAX_MS=6000
LINKEDIN_SEARCH_SCROLLS_MIN=2
LINKEDIN_SEARCH_SCROLLS_MAX=4
```

## Local Config

Edit these ignored local files:

- `config/candidate-profile.local.json`
- `config/searches.local.json`

If local files do not exist, the app uses the safe example files.

## First Run

```bash
npm run linkedin:login
DRY_RUN=true HEADLESS=false npm run start
```

Review output files in `output/`.

## First Sheet Write

```bash
DRY_RUN=false HEADLESS=false npm run start
```

The app writes only to managed tabs. It does not write to `Contacts`, `Warm Paths`, or `Interactions`.
