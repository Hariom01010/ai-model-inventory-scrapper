export default function EmptyHero({ adapters, onQuickAdd, onError }) {
  async function handleQuickAdd() {
    try {
      await onQuickAdd();
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <div className="empty-hero">
      <h1>Track variant stock, one brand at a time</h1>
      <p>
        Add a brand, paste its collection URLs, and see every product&apos;s variants with live
        in-stock / out-of-stock status. Currently supported:{" "}
        {adapters.map((adapter, index) => (
          <span key={adapter.id}>
            {index > 0 && ", "}
            <b>{adapter.brandName}</b>
          </span>
        ))}
        .
      </p>
      <button type="button" className="btn primary" onClick={handleQuickAdd}>
        Add Onitsuka Tiger
      </button>
    </div>
  );
}
