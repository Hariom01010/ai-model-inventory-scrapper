export function buildSelector(item) {
  const tag = item.tagName.toLowerCase();

  if(item.text && item.text.trim().length > 0){
    return `${tag}:text-is("${item.text.trim()}")`;
  }

  const dataAttrs = item.dataAttributes || {};
  const entries = Object.entries(dataAttrs);

  if(entries.length > 0){
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

    if (await element.count() === 0) {
      console.log("❌ Not found:", selector);
      return false;
    }
    await element.evaluate(e => e.click());;

    console.log("✅ Clicked:", selector);
    return true;
  } catch (err) {
    console.log("❌ Click failed:", selector, err.message);
    return false;
  }
}

export function removeDivClusterIfLabelExists(clusters) {
  let labelTexts = new Set();

  // Step 1: collect all label texts across clusters
  for (const cluster of clusters) {
    for (const item of cluster) {
      if (item.tagName === "LABEL" && item.text) {
        labelTexts.add(item.text.trim());
      }
    }
  }

  // Step 2: remove divs that duplicate labels
  return clusters.map(cluster =>
    cluster.filter(item => {
      if (
        item.tagName === "DIV" &&
        labelTexts.has(item.text?.trim())
      ) {
        return false;
      }
      return true;
    })
  );
}