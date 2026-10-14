# Data update runbook

This portal is a **static site**. Villagers never run scripts. Maintainers refresh data offline, then rebuild and deploy.

## 1. Download official reports

Save files under `reports/raw/` (do not overwrite blindly—keep provenance):

| Report | Suggested path | Notes |
|--------|----------------|-------|
| GP vouchers JSON | `reports/raw/vouchers/{YYYY-YYYY}.json` | `getGPVoucherDetailsData.do?finYear=…&stateId=6&lgdCode=33105` |
| Physical progress HTML | `reports/raw/physical-progress/fyear-{YYYY}-wrkstts-176.html` | Completed filter `wrkstts=176` only unless you document other codes |
| Approved action plan | `reports/raw/approved-action-plan/` | Confirm Bohla in the file before import |

For each download, write a sibling `*.meta.json` with `sourceUrl`, `downloadedAt`, `sha256`, and parameters.

**Quarantine** national voucher summaries and non-Bohla plan exports under `reports/quarantine/`.

## 2. Import and validate

```bash
pip install -r requirements.txt
python -m tools.importer run
python -m pytest tools/importer/tests -q
```

Review printed summary: files processed/rejected, row counts, reconciliation variances. Variances are informational—not allegations.

## 3. Build and review

```bash
cd web
npm install
npm run build
npm run preview
```

Check: year selector updates KPIs; missing receipts/balances stay labelled; downloads open.

## 4. Deploy

Push to GitHub; the Pages workflow builds `web/` and publishes `web/dist`. Or upload `web/dist` to any static host (Cloudflare Pages, Netlify, S3).

## 5. Rollback

Redeploy the previous Git tag / previous `public/data` commit. Originals in `reports/raw/` remain the source of truth.

## Honest labelling rules

- Never show `payments − something` as official closing balance.
- Never mix GP/BP/ZP totals.
- Never treat approved work cost as expenditure.
- Missing audit ≠ clean audit.
