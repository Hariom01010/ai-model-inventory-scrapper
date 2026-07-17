/**
 * Brand adapter: Onitsuka Tiger (India store)
 *
 * The site runs Magento 2 (Adobe Commerce) and exposes a public GraphQL
 * endpoint. Collection pages are Magento categories, so instead of parsing
 * markup we ask the same API the storefront uses:
 *
 *   1. route(url: "<path>")            -> category id + name
 *   2. products(filter: {category_id}) -> products with variants + stock
 *
 * Note: this Magento build silently ignores the `category_uid` filter and
 * returns the whole catalog — the legacy `category_id` filter is the one
 * that works, so that is what we use.
 */

const SITE = "https://www.onitsukatiger.com";
const STORE_BASE_PATH = "/in/en-in";
const GRAPHQL_URL = `${SITE}${STORE_BASE_PATH}/graphql`;
const PRODUCT_URL_SUFFIX = ".html";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PAGE_SIZE = 50;
const MAX_PAGES = 40; // safety cap: 2000 products per collection
const PAGE_DELAY_MS = 300;
const REQUEST_TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GARMENT_SIZE_ORDER = Object.fromEntries(
  ["3XS", "XXS", "2XS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL"].map(
    (size, index) => [size, index],
  ),
);

async function gqlRequest(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`GraphQL HTTP ${res.status}`);
    }
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

async function gql(query, { retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await gqlRequest(query);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

const escapeGql = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * Turn any pasted collection URL into the path Magento's route() expects,
 * e.g. https://www.onitsukatiger.com/in/en-in/all/shoes.html -> "all/shoes.html"
 */
function toRoutePath(collectionUrl) {
  const url = new URL(collectionUrl);
  let path = url.pathname;
  if (path.startsWith(STORE_BASE_PATH)) path = path.slice(STORE_BASE_PATH.length);
  path = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!path) {
    throw new Error(
      "This looks like the homepage. Paste a collection URL, e.g. https://www.onitsukatiger.com/in/en-in/all/shoes/sneakers.html",
    );
  }
  return path;
}

async function resolveCategory(collectionUrl) {
  const path = toRoutePath(collectionUrl);
  const data = await gql(
    `{ route(url: "${escapeGql(path)}") { type ... on CategoryTree { id name url_path product_count } } }`,
  );
  const route = data.route;
  if (!route) {
    throw new Error(`Onitsuka Tiger does not recognise this URL (${path}). Is the link correct?`);
  }
  if (route.type !== "CATEGORY") {
    throw new Error(
      `This URL is a ${String(route.type || "page").toLowerCase()}, not a collection. Paste a collection/category URL, e.g. .../all/shoes/sneakers.html`,
    );
  }
  return route;
}

const PRODUCT_FIELDS = `
  __typename
  sku
  name
  url_key
  stock_status
  price_range { minimum_price { final_price { value currency } } }
  ... on ConfigurableProduct {
    configurable_options { attribute_code label position }
    variants {
      attributes { code label }
      product { sku stock_status }
    }
  }
`;

/**
 * The Magento catalog only holds placeholder images; the storefront builds
 * real image URLs from the SKU on the ASICS Scene7 CDN, with a view code that
 * differs by product type (shoes vs garments). We emit both candidates and
 * the frontend falls back to the second if the first 403s.
 */
function imageCandidates(sku, hasFootwearSize) {
  const imageId = sku.replace(/\./g, "_");
  const build = (viewCode) =>
    `https://images.asics.com/is/image/asics/${imageId}_${viewCode}_GLB?$otmag_product_shoes$&qlt=90&wid=320&hei=224`;
  const codes = hasFootwearSize ? ["SR_RT", "GM_FT"] : ["GM_FT", "SR_RT"];
  return codes.map(build);
}

function normalizeProduct(item) {
  const price = item.price_range?.minimum_price?.final_price ?? null;
  // Option display names as configured on the site, e.g. footwear_size -> "Footwear Size"
  const optionLabels = new Map(
    (item.configurable_options ?? []).map((option) => [option.attribute_code, option.label]),
  );

  let variants;
  if (item.__typename === "ConfigurableProduct" && Array.isArray(item.variants)) {
    variants = item.variants.map((variant) => ({
      sku: variant.product?.sku ?? null,
      inStock: variant.product?.stock_status === "IN_STOCK",
      options: (variant.attributes ?? []).map((attribute) => ({
        name: optionLabels.get(attribute.code) ?? attribute.code,
        value: attribute.label,
      })),
    }));
    // The API returns variants in arbitrary order; sort by option values —
    // garment sizes by their natural order, otherwise numerically where
    // possible (e.g. "Men US 10" after "Men US 9.5").
    variants.sort((a, b) => {
      for (let i = 0; i < Math.max(a.options.length, b.options.length); i++) {
        const av = a.options[i]?.value ?? "";
        const bv = b.options[i]?.value ?? "";
        if (av === bv) continue;
        const ag = GARMENT_SIZE_ORDER[av.toUpperCase()];
        const bg = GARMENT_SIZE_ORDER[bv.toUpperCase()];
        if (ag !== undefined && bg !== undefined) return ag - bg;
        const an = parseFloat(av.match(/\d+(\.\d+)?/)?.[0]);
        const bn = parseFloat(bv.match(/\d+(\.\d+)?/)?.[0]);
        if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
        return av.localeCompare(bv);
      }
      return 0;
    });
  } else {
    // Simple products (no selectable options) become a single variant so the
    // rest of the app can treat every product uniformly.
    variants = [
      {
        sku: item.sku,
        inStock: item.stock_status === "IN_STOCK",
        options: [],
      },
    ];
  }

  const hasFootwearSize = (item.configurable_options ?? []).some(
    (option) => option.attribute_code === "footwear_size",
  );
  const [image, imageFallback] = imageCandidates(item.sku, hasFootwearSize);

  return {
    sku: item.sku,
    name: item.name,
    url: `${SITE}${STORE_BASE_PATH}/${item.url_key}${PRODUCT_URL_SUFFIX}`,
    image,
    imageFallback,
    price: price ? { value: price.value, currency: price.currency } : null,
    inStock: item.stock_status === "IN_STOCK",
    variants,
  };
}

async function fetchProductsPage(categoryId, page) {
  const data = await gql(
    `{ products(filter: {category_id: {eq: "${categoryId}"}}, pageSize: ${PAGE_SIZE}, currentPage: ${page}) {
      total_count
      page_info { total_pages current_page }
      items { ${PRODUCT_FIELDS} }
    } }`,
  );
  return data.products;
}

/**
 * Validate a collection URL and return its name without scraping products.
 */
export async function resolveCollection(collectionUrl) {
  const category = await resolveCategory(collectionUrl);
  return { name: category.name, productCount: category.product_count };
}

/**
 * Scrape a collection: every product with every variant and its stock status.
 */
export async function scrapeCollection(collectionUrl, { onProgress } = {}) {
  const category = await resolveCategory(collectionUrl);
  const products = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await fetchProductsPage(category.id, page);
    totalPages = Math.min(result.page_info?.total_pages ?? 1, MAX_PAGES);
    products.push(...result.items.map(normalizeProduct));
    onProgress?.({ page, totalPages, products: products.length, total: result.total_count });
    page += 1;
    if (page <= totalPages) await sleep(PAGE_DELAY_MS);
  } while (page <= totalPages);

  return { name: category.name, products };
}

export default {
  id: "onitsuka-tiger",
  brandName: "Onitsuka Tiger",
  domains: ["onitsukatiger.com"],
  exampleCollectionUrl: `${SITE}${STORE_BASE_PATH}/all/shoes/sneakers.html`,
  resolveCollection,
  scrapeCollection,
};
