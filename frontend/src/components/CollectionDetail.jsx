import { useMemo, useState } from "react";
import { timeAgo } from "../api.js";
import SummaryChips from "./SummaryChips.jsx";
import ProductTable from "./ProductTable.jsx";

const STOCK_FILTERS = [
  { key: "all", label: "All" },
  { key: "in", label: "In stock" },
  { key: "out", label: "Out of stock" },
];

function variantMatches(variant, product, needle) {
  if (!needle) return true;
  const haystack = [
    product.name,
    product.sku,
    variant.sku,
    ...variant.options.map((option) => `${option.name} ${option.value}`),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export default function CollectionDetail({ detail, brandName, onBack, onScrape, onError }) {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  const running = detail.scrapeStatus === "running";
  const failed = detail.scrapeStatus === "error";
  const products = detail.snapshot?.products ?? [];

  const { filtered, shownVariants } = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = [];
    let count = 0;
    for (const product of products) {
      const variants = product.variants.filter((variant) => {
        if (stockFilter === "in" && !variant.inStock) return false;
        if (stockFilter === "out" && variant.inStock) return false;
        return variantMatches(variant, product, needle);
      });
      if (!variants.length) continue;
      count += variants.length;
      result.push({ product, variants });
    }
    return { filtered: result, shownVariants: count };
  }, [products, search, stockFilter]);

  // Same-origin API route; the stock filter carries over so the file matches
  // what's on screen (search text is client-only and not applied).
  const exportHref = `/api/collections/${detail.id}/export.csv${
    stockFilter === "all" ? "" : `?stock=${stockFilter}`
  }`;

  async function handleScrape() {
    try {
      await onScrape(detail.id);
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <>
      <button type="button" className="back-link" onClick={onBack}>
        ← {brandName ?? "Back"}
      </button>
      <div className="page-head">
        <div>
          <h1>{detail.name}</h1>
          <div className="sub">
            <a href={detail.url} target="_blank" rel="noopener noreferrer">
              View on site ↗
            </a>
            <span>·</span>
            <span>Updated {timeAgo(detail.lastScrapedAt)}</span>
          </div>
        </div>
        <div className="actions">
          {products.length > 0 && (
            <a className="btn" href={exportHref} download>
              ⬇ Export CSV
            </a>
          )}
          <button type="button" className="btn" onClick={handleScrape} disabled={running}>
            {running ? (
              <>
                <span className="spinner" /> Scraping…
              </>
            ) : (
              "↻ Refresh stock"
            )}
          </button>
        </div>
      </div>

      <SummaryChips summary={detail.summary} style={{ marginTop: 6 }} />
      {running && (
        <div className="scrape-banner">
          <span className="spinner" /> Scraping the live site — results update automatically.
        </div>
      )}
      {failed && detail.scrapeError && (
        <div
          className="scrape-banner"
          style={{ background: "var(--red-bg)", borderColor: "#eec3c8", color: "var(--red)" }}
        >
          Last scrape failed: {detail.scrapeError}
        </div>
      )}

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search product, SKU or size…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="seg">
          {STOCK_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={stockFilter === filter.key ? "active" : ""}
              onClick={() => setStockFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <span className="result-count">{shownVariants} variants shown</span>
      </div>

      <ProductTable groups={filtered} hasProducts={products.length > 0} stockFilter={stockFilter} />
    </>
  );
}
