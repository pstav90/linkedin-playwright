# LinkedIn Usage

`career-agent` sources roles from LinkedIn job search pages and LinkedIn job collection links.

## Login

```bash
npm run linkedin:login
```

This opens a local Playwright Chromium window using `./browser-profile`. Log into LinkedIn manually. The profile is ignored by Git because it may contain cookies and session data.

## Configured Searches

Edit `config/searches.local.json`:

```json
{
  "linkedin": {
    "enabled": true,
    "queries": [
      {
        "name": "AI product leadership",
        "url": "https://www.linkedin.com/jobs/search/?keywords=principal%20product%20manager%20AI"
      }
    ],
    "maxJobsPerQuery": 15
  }
}
```

## One-Off Link

```bash
DRY_RUN=true HEADLESS=false LINK="https://www.linkedin.com/jobs/collections/recommended/?currentJobId=0000000000" npm run start
```

`LINK_NAME` is optional and controls the source label:

```bash
DRY_RUN=true HEADLESS=false LINK="https://www.linkedin.com/jobs/search/?keywords=product%20growth" LINK_NAME="Product growth search" npm run start
```

## Location Filtering

The app adds `LINKEDIN_SEARCH_LOCATION` to LinkedIn search URLs when the URL does not already include a location. It then rejects roles unless the card/detail location or JD text matches `LINKEDIN_ALLOWED_LOCATIONS`.

Example:

```bash
LINKEDIN_SEARCH_LOCATION=San Francisco Bay Area
LINKEDIN_ALLOWED_LOCATIONS=remote,san francisco,san francisco bay area,oakland,palo alto,mountain view,san jose
```

Set `LINKEDIN_ALLOWED_LOCATIONS=` to allow all locations.

## Rate-Limit Posture

V1 is intentionally conservative:

- small `maxJobsPerQuery`
- visible browser by default
- local logged-in session
- random page delays
- random search scroll counts

You can tune:

```bash
LINKEDIN_PAGE_DELAY_MIN_MS=3000
LINKEDIN_PAGE_DELAY_MAX_MS=6000
LINKEDIN_SEARCH_SCROLLS_MIN=2
LINKEDIN_SEARCH_SCROLLS_MAX=4
```

Use the tool like a local assistant, not a high-volume scraper.
