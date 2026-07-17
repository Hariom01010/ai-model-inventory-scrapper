/**
 * Adapter registry.
 *
 * One adapter per brand/platform. Adding support for a new website means
 * writing one adapter module (resolveCollection + scrapeCollection) and
 * listing it here — nothing else in the app changes.
 */
import onitsukaTiger from "./adapters/onitsuka-tiger.js";

const adapters = [onitsukaTiger];

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function findAdapterForUrl(url) {
  const hostname = hostnameOf(url);
  if (!hostname) return null;
  return (
    adapters.find((adapter) =>
      adapter.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)),
    ) ?? null
  );
}

export function listAdapters() {
  return adapters.map(({ id, brandName, domains, exampleCollectionUrl }) => ({
    id,
    brandName,
    domains,
    exampleCollectionUrl,
  }));
}
