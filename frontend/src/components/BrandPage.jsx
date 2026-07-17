import { useState } from "react";
import CollectionCard from "./CollectionCard.jsx";

function adapterForWebsite(adapters, website) {
  try {
    const hostname = new URL(website).hostname.toLowerCase();
    return (
      adapters.find((adapter) =>
        adapter.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export default function BrandPage({
  brand,
  adapters,
  onAddCollection,
  onDeleteBrand,
  onDeleteCollection,
  onScrape,
  onView,
  onError,
}) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const adapter = adapterForWebsite(adapters, brand.website);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!url.trim()) {
      onError("Paste a collection URL first.");
      return;
    }
    setSubmitting(true);
    try {
      await onAddCollection(brand.id, url.trim());
      setUrl("");
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{brand.name}</h1>
          <div className="sub">
            <a href={brand.website} target="_blank" rel="noopener noreferrer">
              {brand.website}
            </a>
            {brand.supported ? (
              <span className="badge yes">adapter ready</span>
            ) : (
              <span className="badge no">no adapter yet</span>
            )}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn subtle" onClick={() => onDeleteBrand(brand)}>
            Delete brand
          </button>
        </div>
      </div>

      <form className="add-collection" onSubmit={handleSubmit}>
        <input
          placeholder={`Paste a collection URL, e.g. ${adapter?.exampleCollectionUrl ?? "https://…"}`}
          autoComplete="off"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" /> Adding…
            </>
          ) : (
            "Track collection"
          )}
        </button>
      </form>
      <p className="hint">
        The collection name, its products and variant stock are fetched automatically.{" "}
        {adapter ? (
          <>
            Try <code>{adapter.exampleCollectionUrl}</code>
          </>
        ) : (
          "This brand's domain has no scraper adapter yet — collections can't be scraped until one is added."
        )}
      </p>

      {brand.collections.length === 0 ? (
        <div className="card" style={{ color: "var(--ink-soft)" }}>
          No collections tracked yet. Paste a collection URL above to start.
        </div>
      ) : (
        <div className="collection-grid">
          {brand.collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onView={onView}
              onScrape={onScrape}
              onDelete={onDeleteCollection}
              onError={onError}
            />
          ))}
        </div>
      )}
    </>
  );
}
