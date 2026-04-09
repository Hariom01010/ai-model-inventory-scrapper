export function buildSelector(item) {
  const tag = item.tagName.toLowerCase();

  if (item.text && item.text.trim().length > 0) {
    return `${tag}:text-is("${item.text.trim()}")`;
  }

  const dataAttrs = item.dataAttributes || {};
  const entries = Object.entries(dataAttrs);

  if (entries.length > 0) {
    const attrSelector = entries
      .map(([key, value]) => `[${key}="${value}"]`)
      .join("");

    return `${tag}${attrSelector}`;
  }

  return null;
}

export async function clickVariant(page, item) {
  const selector = buildSelector(item);

  if (!selector) {
    console.log("❌ No selector for item", item);
    return false;
  }

  try {
    const element = await page.locator(selector).nth(0);

    if ((await element.count()) === 0) {
      console.log("❌ Not found:", selector);
      return false;
    }
    await element.evaluate((e) => e.click());

    console.log("✅ Clicked:", selector);
    return true;
  } catch (err) {
    console.log("❌ Click failed:", selector, err.message);
    return false;
  }
}

function getSignature(cluster) {
  const texts =  cluster.map((el) => (el.text || "").trim()).join("|");
  return [...new Set(texts)].join("|");
}
function getPriority(cluster) {
  let score = 0;

  for (const el of cluster) {
    const tag = el.tagName?.toLowerCase();

    if (tag === "label") score += 2;
    else if (tag === "div") score += 1;
  }

  return score;
}

export function dedupeClusters(clusters) {
  const map = new Map();

  for (const cluster of clusters) {
    const signature = getSignature(cluster);
    const priority = getPriority(cluster);

    if (!map.has(signature)) {
      map.set(signature, { cluster, priority });
    } else {
      const existing = map.get(signature);

      if (priority > existing.priority) {
        map.set(signature, { cluster, priority });
      }
    }
  }

  return Array.from(map.values()).map((v) => v.cluster);
}
