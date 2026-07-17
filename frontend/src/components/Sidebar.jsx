import { useState } from "react";

export default function Sidebar({ brands, selectedBrandId, onSelectBrand, onAddBrand, onError }) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || !website.trim()) {
      onError("Enter a brand name and website URL.");
      return;
    }
    const url = /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`;
    setSubmitting(true);
    try {
      await onAddBrand(name.trim(), url);
      setName("");
      setWebsite("");
    } catch (error) {
      onError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="mark">📦</span>
        <span>
          Inventory Tracker
          <small>variant stock monitor</small>
        </span>
      </div>

      <div>
        <div className="side-label">Brands</div>
        <div className="brand-list">
          {brands.length === 0 ? (
            <div className="side-empty">
              No brands yet.
              <br />
              Add your first brand below.
            </div>
          ) : (
            brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                className={`brand-item ${brand.id === selectedBrandId ? "active" : ""}`}
                onClick={() => onSelectBrand(brand.id)}
              >
                <span
                  className={`dot ${brand.supported ? "supported" : ""}`}
                  title={brand.supported ? "Scraper adapter available" : "No adapter yet"}
                />
                <span>{brand.name}</span>
                <span className="meta">{brand.collections.length}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <form className="add-brand" onSubmit={handleSubmit}>
        <h3>Add brand</h3>
        <input
          placeholder="Brand name (e.g. Onitsuka Tiger)"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          placeholder="https://www.onitsukatiger.com"
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <div className="row">
          <button className="btn primary" type="submit" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? "Adding…" : "Add brand"}
          </button>
        </div>
      </form>
    </aside>
  );
}
