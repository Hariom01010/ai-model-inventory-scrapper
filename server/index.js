import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { db, save } from "./db.js";
import { findAdapterForUrl, listAdapters } from "./scraper/registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3000;

const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");

const app = express();
app.use(express.json());
app.use(express.static(FRONTEND_DIST));
app.get("/", (req, res, next) => {
  if (fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) return next();
  res
    .status(503)
    .type("text/plain")
    .send("Frontend not built yet. Run `npm run build` first, or use `npm run dev` for the dev server on http://localhost:5173");
});

/* ------------------------------- helpers -------------------------------- */

const newId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

function snapshotSummary(collectionId) {
  const snapshot = db.snapshots[collectionId];
  if (!snapshot) return null;
  let variants = 0;
  let inStock = 0;
  for (const product of snapshot.products) {
    variants += product.variants.length;
    inStock += product.variants.filter((variant) => variant.inStock).length;
  }
  return {
    scrapedAt: snapshot.scrapedAt,
    products: snapshot.products.length,
    variants,
    inStock,
    outOfStock: variants - inStock,
  };
}

function collectionView(collection) {
  return { ...collection, summary: snapshotSummary(collection.id) };
}

function brandView(brand) {
  return {
    ...brand,
    supported: !!findAdapterForUrl(brand.website),
    collections: db.collections
      .filter((collection) => collection.brandId === brand.id)
      .map(collectionView),
  };
}

function parseUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/* ----------------------------- scrape runner ----------------------------- */

async function runScrape(collection) {
  const adapter = findAdapterForUrl(collection.url);
  collection.scrapeStatus = "running";
  collection.scrapeError = null;
  collection.scrapeProgress = null;
  save();

  try {
    const result = await adapter.scrapeCollection(collection.url, {
      onProgress(progress) {
        collection.scrapeProgress = progress;
      },
    });
    db.snapshots[collection.id] = {
      scrapedAt: new Date().toISOString(),
      products: result.products,
    };
    collection.name = result.name || collection.name;
    collection.lastScrapedAt = db.snapshots[collection.id].scrapedAt;
    collection.scrapeStatus = "idle";
  } catch (error) {
    console.error(`[scrape] ${collection.url} failed:`, error);
    collection.scrapeStatus = "error";
    collection.scrapeError = error.message;
  } finally {
    collection.scrapeProgress = null;
    save();
  }
}

function startScrape(collection) {
  if (collection.scrapeStatus === "running") return false;
  // Fire and forget; clients poll the collection for status.
  runScrape(collection);
  return true;
}

/* --------------------------------- API ---------------------------------- */

app.get("/api/adapters", (req, res) => {
  res.json(listAdapters());
});

app.get("/api/brands", (req, res) => {
  res.json(db.brands.map(brandView));
});

app.post("/api/brands", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const website = parseUrl(String(req.body?.website ?? "").trim());
  if (!name) return res.status(400).json({ error: "Brand name is required." });
  if (!website) return res.status(400).json({ error: "A valid website URL is required." });
  if (db.brands.some((brand) => brand.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: `Brand "${name}" already exists.` });
  }

  const brand = {
    id: newId("brand"),
    name,
    website,
    createdAt: new Date().toISOString(),
  };
  db.brands.push(brand);
  save();
  res.status(201).json(brandView(brand));
});

app.delete("/api/brands/:id", (req, res) => {
  const index = db.brands.findIndex((brand) => brand.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Brand not found." });
  const removedCollections = db.collections.filter((c) => c.brandId === req.params.id);
  for (const collection of removedCollections) delete db.snapshots[collection.id];
  db.collections = db.collections.filter((c) => c.brandId !== req.params.id);
  db.brands.splice(index, 1);
  save();
  res.json({ ok: true });
});

app.post("/api/brands/:brandId/collections", async (req, res) => {
  const brand = db.brands.find((b) => b.id === req.params.brandId);
  if (!brand) return res.status(404).json({ error: "Brand not found." });

  const url = parseUrl(String(req.body?.url ?? "").trim());
  if (!url) return res.status(400).json({ error: "A valid collection URL is required." });

  const adapter = findAdapterForUrl(url);
  if (!adapter) {
    const supported = listAdapters()
      .flatMap((a) => a.domains)
      .join(", ");
    return res.status(422).json({
      error: `No scraper adapter for this domain yet. Supported so far: ${supported}. New brands are added one adapter at a time.`,
    });
  }
  if (db.collections.some((c) => c.brandId === brand.id && c.url === url)) {
    return res.status(409).json({ error: "This collection is already being tracked." });
  }

  let resolved;
  try {
    resolved = await adapter.resolveCollection(url);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }

  const collection = {
    id: newId("col"),
    brandId: brand.id,
    name: resolved.name,
    url,
    createdAt: new Date().toISOString(),
    lastScrapedAt: null,
    scrapeStatus: "idle",
    scrapeError: null,
  };
  db.collections.push(collection);
  save();
  startScrape(collection);
  res.status(201).json(collectionView(collection));
});

app.get("/api/collections/:id", (req, res) => {
  const collection = db.collections.find((c) => c.id === req.params.id);
  if (!collection) return res.status(404).json({ error: "Collection not found." });
  const snapshot = db.snapshots[collection.id] ?? null;
  res.json({ ...collectionView(collection), snapshot });
});

app.post("/api/collections/:id/scrape", (req, res) => {
  const collection = db.collections.find((c) => c.id === req.params.id);
  if (!collection) return res.status(404).json({ error: "Collection not found." });
  startScrape(collection);
  res.json(collectionView(collection));
});

app.delete("/api/collections/:id", (req, res) => {
  const index = db.collections.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Collection not found." });
  delete db.snapshots[req.params.id];
  db.collections.splice(index, 1);
  save();
  res.json({ ok: true });
});

/* -------------------------------- start ---------------------------------- */

// Anything mid-scrape when the server last stopped is not running anymore.
for (const collection of db.collections) {
  if (collection.scrapeStatus === "running") collection.scrapeStatus = "idle";
}

app.listen(PORT, () => {
  console.log(`Inventory tracker running at http://localhost:${PORT}`);
});
