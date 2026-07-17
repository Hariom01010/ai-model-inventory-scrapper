# Inventory Tracker

Tracks which product variants (size / color) are **in stock** or **out of stock** on brand
websites, per collection, with a web UI.

## Approach

The first prototype tried to solve every website at once with ML models (product-card
classifier + variant clustering). Markup differs too much between shops, so it was not
reliable anywhere. We now work brand by brand ("agile" — one adapter at a time):

- **Brand adapters** (`server/scraper/adapters/`) know how one specific website exposes
  its data and return a normalized result: collection → products → variants → stock.
- The first adapter is **Onitsuka Tiger** (`onitsukatiger.com`). The site runs Magento 2,
  so the adapter talks straight to the storefront GraphQL API — deterministic, fast,
  no browser automation and no ML.
- Adding the next brand = writing one adapter file and registering it in
  `server/scraper/registry.js`. Nothing else changes.

## Stack

- **Backend**: Node.js + Express (`server/`), JSON-file persistence (`data/db.json`).
- **Frontend**: React 18 + Vite (`frontend/src/`), no CSS framework — plain CSS in
  `frontend/src/styles.css`.

## Running it

Requires Node.js 18+ (native `fetch`).

```bash
npm install
npm run build      # build the React frontend (frontend/dist)
npm start          # serve app + API at http://localhost:3000
```

For development with hot reload:

```bash
npm run dev        # Express on :3000 (--watch) + Vite dev server on :5173 (/api proxied)
```

Open http://localhost:5173 during development; the production app is whatever
`npm start` serves at http://localhost:3000 after a build.

## Using the UI

1. **Add a brand** (sidebar) — e.g. name `Onitsuka Tiger`, website
   `https://www.onitsukatiger.com`.
2. **Track a collection** — paste a collection URL, e.g.
   `https://www.onitsukatiger.com/in/en-in/all/shoes/sneakers.html`.
   The collection name is resolved automatically and the first scrape starts immediately.
3. Open the collection to see every product with its variants
   (e.g. `COLOR: BLACK/WHITE · Footwear Size: Men US 8`) and a live
   **In stock / Out of stock** badge. Filter by status or search, hit
   **Refresh stock** any time.

Scraped data is persisted to `data/db.json` (gitignored). While a scrape runs, the
UI polls the API and updates automatically.

## API

| Method | Path                              | Purpose                                  |
| ------ | --------------------------------- | ---------------------------------------- |
| GET    | `/api/adapters`                   | Supported brand adapters                 |
| GET    | `/api/brands`                     | Brands with collections + stock summary  |
| POST   | `/api/brands`                     | Add brand `{name, website}`              |
| DELETE | `/api/brands/:id`                 | Remove brand (and its collections)       |
| POST   | `/api/brands/:id/collections`     | Track collection `{url}` (auto-scrapes)  |
| GET    | `/api/collections/:id`            | Collection + full product/variant data   |
| POST   | `/api/collections/:id/scrape`     | Re-scrape a collection                   |
| DELETE | `/api/collections/:id`            | Stop tracking a collection               |

## Legacy prototype

The original ML crawler is still in the repo (`index.js`, `constants.js`, `utils.js`,
`model/`) and runs via `npm run legacy:crawler` + the FastAPI service in `model/`.
It is kept for reference only.
