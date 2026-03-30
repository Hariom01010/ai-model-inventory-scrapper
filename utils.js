import { VARIANT_CANDIDATES } from "./constants.js";

export async function collectViewportElements(page) {
  const selectorQuery = VARIANT_CANDIDATES.join(",");
  const locator = page.locator(selectorQuery);

  const elements = [];

  for (let i = 0; i < (await locator.count()); i++) {
    const element = locator.nth(i);

    if (!(await element.isVisible())) continue;

    const inViewPort = await element.evaluate((node) => {
      const rect = node.getBoundingClientRect();

      if (
        !(
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth
        )
      ) {
        return false;
      }

      const excludedTags = ["HEADER", "FOOTER", "NAV"];
      let parent = node;

      while (parent) {
        if (excludedTags.includes(parent.tagName)) return false;
        parent = parent.parentElement;
      }

      return true;
    });

    if (!inViewPort) continue;

    elements.push(element);
  }

  return elements;
}

export async function extractElementInfo(elements) {
  const result = [];

  for (const element of elements) {
    const info = await element.evaluate((node) => {
      const rect = node.getBoundingClientRect();

      const hasDirectImage = node.tagName === "IMG" || node.tagName === "SVG";
      const hasChildImage =
        node.querySelector('img, svg, [role="img"]') !== null;
      const hasBackgroundImage =
        window.getComputedStyle(node).backgroundImage !== "none";

      const isNativeClickable = [
        "A",
        "BUTTON",
        "INPUT",
        "SELECT",
        "TEXTAREA",
      ].includes(node.tagName);
      const hasClickableRole = [
        "button",
        "link",
        "checkbox",
        "radio",
        "menuitem",
        "option",
      ].includes(node.getAttribute("role"));
      const style = window.getComputedStyle(node);
      const hasPointerCursor = style.cursor === "pointer";
      const isNotDisabled =
        !node.disabled && node.getAttribute("aria-disabled") !== "true";

      const isClickable =
        (isNativeClickable || hasClickableRole || hasPointerCursor) &&
        isNotDisabled;

      return {
        text:
          node.innerText?.trim() ||
          node.getAttribute("aria-label") ||
          node.getAttribute("title") ||
          "",
        classes: node.className,
        id: node.id || "",
        name: node.getAttribute("name") || "",
        aria: node.getAttribute("aria-label") || "",
        role: node.getAttribute("role") || "",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        tagName: node.tagName,
        parentHash: node.parentElement
          ? `${node.parentElement.tagName}_${node.parentElement.children.length}`
          : "root",
        siblingCount: node.parentElement
          ? node.parentElement.children.length - 1
          : 0,
        childCount: node.childElementCount,
        hasImage: hasDirectImage || hasChildImage || hasBackgroundImage,
        isClickable,
      };
    });

    result.push({
      locator: element,
      ...info,
    });
  }

  result.sort((a, b) => a.y - b.y);

  return result;
}
export async function normalizeInputLabels(elementsInfo) {
  const swatchElements = [];
  const usedInputs = new Set();

  for (const el of elementsInfo) {
    if (el.tagName === "INPUT") {
      const id = await el.locator.getAttribute("id");
      if (!id) continue;

      let matchedLabel = null;

      for (const candidate of elementsInfo) {
        if (candidate.tagName !== "LABEL") continue;

        const forAttr = await candidate.locator.getAttribute("for");

        if (forAttr === id) {
          matchedLabel = candidate;
          break;
        }
      }

      if (matchedLabel) {
        swatchElements.push({
          ...matchedLabel,
          locator: matchedLabel.locator,
        });

        usedInputs.add(id);
        continue;
      }
    }

    if (el.tagName === "LABEL") {
      const forAttr = await el.locator.getAttribute("for");

      if (forAttr && usedInputs.has(forAttr)) continue;
    }

    swatchElements.push(el);
  }

  return swatchElements;
}
function clusterElements(elements) {
  const clusters = [];

  let currentCluster = [elements[0]];

  for (let i = 1; i < elements.length; i++) {
    const current = elements[i];

    const nearestColumnElement = currentCluster.reduce((closest, el) => {
      const dist = Math.abs(el.x - current.x);

      if (!closest || dist < closest.dist) {
        return { el, dist };
      }

      return closest;
    }, null)?.el;

    let shouldJoinCluster = false;

    if (nearestColumnElement) {
      const MAX_VERTICAL_GAP = 70;

      const yDist = Math.abs(current.y - nearestColumnElement.y);
      const xDist = Math.abs(current.x - nearestColumnElement.x);

      const distance = Math.sqrt(xDist ** 2 + yDist ** 2);

      shouldJoinCluster = distance < 150 && yDist < MAX_VERTICAL_GAP;
    }

    if (shouldJoinCluster) {
      currentCluster.push(current);
    } else {
      clusters.push(currentCluster);
      currentCluster = [current];
    }
  }

  clusters.push(currentCluster);

  return clusters;
}
