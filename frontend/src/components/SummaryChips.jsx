export default function SummaryChips({ summary, style }) {
  if (!summary) return null;
  return (
    <div className="chips" style={style}>
      <span className="chip">{summary.products} products</span>
      <span className="chip">{summary.variants} variants</span>
      <span className="chip green">{summary.inStock} in stock</span>
      <span className="chip red">{summary.outOfStock} out of stock</span>
    </div>
  );
}
