# EI FIT Costing Tool

Internal tool for Europe Incoming staff to generate client quotes and internal cost breakdowns from sales lead emails.

## How to use

1. Open the GitHub Pages URL
2. Enter your GitHub Models API key (one-time, saved in your browser)
3. Paste the lead email
4. Optionally upload a competitor quote or itinerary document
5. Click **Generate Quote**
6. Download the two output files:
   - **Client Quote** — send to the travel agent (open in browser → Print → Save as PDF)
   - **Internal Costing Sheet** — keep for your records

## Updating rate sheets

Rate data lives in the `/data/` folder as JSON files. When prices change:

| File | What it contains |
|------|-----------------|
| `data/pg_rates.json` | Coach, guide, tour manager rates (per group) |
| `data/pp_rates.json` | Entrances, meals, ferry rates (per person) |
| `data/hotel_rates.json` | Hotel rates by city and season |
| `data/city_country.json` | City → country mapping + country proxy fallbacks |

To update: edit the source CSV files, re-run the Python parse script (`scripts/parse_rates.py`), and commit the updated JSON files.

## Repo structure

```
index.html          ← staff UI
logo.png            ← Europe Incoming logo
data/
  pg_rates.json
  pp_rates.json
  hotel_rates.json
  city_country.json
js/
  engine.js         ← all pricing logic (Brahms/Beethoven/Bach/Chopin)
  documents.js      ← document generators (Wagner/Mozart)
```

## API key

Uses GitHub Models (GPT-4o mini) for email parsing only. Get your token at github.com → Settings → Developer settings → Personal access tokens → Fine-grained → Models: read.

The key is stored in your browser's localStorage only.
