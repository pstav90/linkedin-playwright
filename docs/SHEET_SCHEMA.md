# Google Sheet Schema

The Google Sheet is the CRM and source of truth for manual review.

## Managed Tabs

The app can create or repair these tabs when `DRY_RUN=false`:

- `Roles`
- `Companies`
- `Interview Prep`

## Protected User-Managed Tabs

The app does not create, repair, or write these tabs:

- `Contacts`
- `Warm Paths`
- `Interactions`

## Roles Columns

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

## Manual Fields

Existing role rows preserve:

- `Manual Score Override`
- `Status`
- `Notes`
- manually edited `Access Score`

## Machine-Owned Fields

For duplicate roles, the app updates only:

- `Role Title`
- `Final Bucket`
- `Agent Score`
- `Fit Score`
- `Financial Upside Score`
- `Compensation Score`
- `Scope Score`
- `Prestige Score`
- `Score Rationale`
- `Last Updated`
- `Source`

## Final Bucket Formula

`Final Bucket` uses `Manual Score Override` when present, otherwise `Agent Score`.

Buckets:

- `Pursue`: 90-100
- `Potential`: 75-89
- `Monitor`: 60-74
- `Deprioritize`: below 60
