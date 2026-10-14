# Bohla Gram Panchayat Transparency Portal

Independent, Hindi-first, mobile-first public transparency site for **Bohla** Gram Panchayat (LGD `33105`), Sonipat block & district, Haryana.

This is **not** an official government website. Figures are taken from public [eGramSwaraj](https://egramswaraj.gov.in/) reports that maintainers download and normalize into static JSON.

## Stack

- **Frontend:** React + TypeScript + Vite (static SPA, HashRouter)
- **Data import:** Python CLI (`tools.importer`) — no backend, no database
- **Hosting:** GitHub Pages (or any static host)

## Quick start

```bash
# 1) Normalize reports → web/public/data
pip install -r requirements.txt
python -m tools.importer run

# 2) Run the site
cd web
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command | Purpose |
|---------|---------|
| `python -m tools.importer run` | Parse `reports/raw/` → `web/public/data/` |
| `python -m pytest tools/importer/tests -q` | Parser / money logic tests (synthetic fixtures) |
| `cd web && npm run build` | Production static build → `web/dist` |
| `cd web && npm run preview` | Preview production build |

## Data update

See [docs/DATA_UPDATE.md](docs/DATA_UPDATE.md).

## MVP pages

Home · Funds · Works · Vouchers · Schemes · Audit (empty/neutral) · Downloads · About the data

## License / use

Public-interest transparency project. Always cite eGramSwaraj as the source of official figures.
