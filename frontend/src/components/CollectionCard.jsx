import { timeAgo } from "../api.js";
import SummaryChips from "./SummaryChips.jsx";

export default function CollectionCard({ collection, onView, onScrape, onDelete, onError }) {
  const running = collection.scrapeStatus === "running";
  const failed = collection.scrapeStatus === "error";

  async function handleScrape() {
    try {
      await onScrape(collection.id);
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <div className="card collection-card">
      <div className="top">
        <h3>{collection.name}</h3>
        {running && (
          <span className="badge warn">
            <span className="spinner" />
            &nbsp;scraping…
          </span>
        )}
        {failed && <span className="badge no">last scrape failed</span>}
      </div>
      <div className="url" title={collection.url}>
        {collection.url}
      </div>
      <SummaryChips summary={collection.summary} />
      {failed && collection.scrapeError && (
        <div className="error-text">{collection.scrapeError}</div>
      )}
      <div className="foot">
        <span className="stamp">Updated {timeAgo(collection.lastScrapedAt)}</span>
        <button
          type="button"
          className="btn small"
          onClick={() => onView(collection.id)}
          disabled={!collection.summary && !running}
        >
          View
        </button>
        <button type="button" className="btn small" onClick={handleScrape} disabled={running}>
          Refresh
        </button>
        <button
          type="button"
          className="btn small subtle"
          title="Stop tracking"
          onClick={() => onDelete(collection)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
