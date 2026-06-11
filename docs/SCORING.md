# Scoring

Roles are scored on a 100-point scale:

| Category | Weight |
| --- | ---: |
| Fit | 30 |
| Financial Upside | 25 |
| Compensation Potential | 20 |
| Scope / Level | 10 |
| Prestige / Career Signal | 10 |
| Access / Warm Intro Potential | 5 |

## Classifications

| Effective Score | Final Bucket |
| ---: | --- |
| 90-100 | Pursue |
| 75-89 | Potential |
| 60-74 | Monitor |
| <60 | Deprioritize |

## V1 Notes

Access Score defaults to `1`. If a role already exists in Google Sheets and Access Score has been manually edited, the app preserves that manual value.

The visible `Final Bucket` column is a formula: it uses `Manual Score Override` when present, otherwise `Agent Score`, then maps the effective score into the bucket labels.

For existing rows, only machine-owned role fields are updated:

- Agent Score
- Fit Score
- Financial Upside Score
- Compensation Score
- Scope Score
- Prestige Score
- Final Bucket
- Score Rationale
- Last Updated

The app never overwrites `Manual Score Override`, `Status`, `Notes`, or manually edited `Access Score`.
