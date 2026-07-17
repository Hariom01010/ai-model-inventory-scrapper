import { Fragment, useState } from "react";
import { formatPrice } from "../api.js";

/** Product thumbnail with a fallback chain: primary URL → fallback URL → hidden. */
function ProductImage({ product }) {
  const [stage, setStage] = useState(0);
  const src = stage === 0 ? product.image : stage === 1 ? product.imageFallback : null;
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      decoding="async"
      onError={() => setStage((current) => (current === 0 && product.imageFallback ? 1 : 2))}
    />
  );
}

function VariantRow({ variant }) {
  return (
    <tr>
      <td>
        <div className="variant-opts">
          {variant.options.length ? (
            variant.options.map((option) => (
              <span key={option.name} className="opt">
                <b>{option.name}</b>
                {option.value}
              </span>
            ))
          ) : (
            <span className="opt">One size / default</span>
          )}
        </div>
      </td>
      <td className="variant-sku">{variant.sku ?? ""}</td>
      <td />
      <td>
        {variant.inStock ? (
          <span className="status in">In stock</span>
        ) : (
          <span className="status out">Out of stock</span>
        )}
      </td>
    </tr>
  );
}

export default function ProductTable({ groups, hasProducts }) {
  return (
    <table className="product-table">
      <thead>
        <tr>
          <th style={{ width: "44%" }}>Product / Variant</th>
          <th style={{ width: "18%" }}>SKU</th>
          <th style={{ width: "14%" }}>Price</th>
          <th style={{ width: "24%" }}>Stock status</th>
        </tr>
      </thead>
      <tbody>
        {groups.length === 0 ? (
          <tr>
            <td colSpan={4} className="table-empty">
              {hasProducts ? "Nothing matches the current filter." : "No products captured yet."}
            </td>
          </tr>
        ) : (
          groups.map(({ product, variants }) => {
            const inStockCount = product.variants.filter((variant) => variant.inStock).length;
            return (
              <Fragment key={product.sku}>
                <tr className="product-row">
                  <td colSpan={2}>
                    <div className="product-cell">
                      <ProductImage product={product} />
                      <div>
                        <div className="name">
                          <a href={product.url} target="_blank" rel="noopener noreferrer">
                            {product.name}
                          </a>
                        </div>
                        <div className="sku">{product.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="product-price">{formatPrice(product.price)}</td>
                  <td className="product-stock-summary">
                    {inStockCount}/{product.variants.length} variants in stock
                  </td>
                </tr>
                {variants.map((variant) => (
                  <VariantRow key={variant.sku ?? JSON.stringify(variant.options)} variant={variant} />
                ))}
              </Fragment>
            );
          })
        )}
      </tbody>
    </table>
  );
}
