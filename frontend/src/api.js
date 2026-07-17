export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleString();
}

export function formatPrice(price) {
  if (!price) return "";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: price.currency,
      maximumFractionDigits: 0,
    }).format(price.value);
  } catch {
    return `${price.currency} ${price.value}`;
  }
}
