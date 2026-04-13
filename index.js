import {
  NAVBAR_CANDIDATES,
  STORE_URLS,
  VARIANT_CANDIDATES,
} from "./constants.js";
import { chromium } from "playwright";
import path from "path";
import fs from "fs/promises";
import { clickVariant, dedupeClusters } from "./utils.js";

async function predictProductCards(items) {
  const res = await fetch("http://127.0.0.1:8000/predict/product-card/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  const data = await res.json();
  return data.results;
}

async function clusterProductVariants(items) {
  const res = await fetch("http://127.0.0.1:8000/cluster", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  const data = await res.json();
  return data.results;
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });

  const allStoresData = [];
  // Extract Product URLs
  for (let i = 0; i < STORE_URLS.length; i++) {
    try {
      console.log(`[INFO]: Visiting ${STORE_URLS[i]}`);
      let page = await context.newPage();
      await page.goto(STORE_URLS[i], { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const elements = await page.evaluate(() => {
        const isVisible = (el) => {
          return (
            el.offsetWidth > 0 &&
            el.offsetHeight > 0 &&
            el.getClientRects().length > 0
          );
        };

        const candidates = Array.from(
          document.querySelectorAll("div, li, article, a"),
        );

        const candidateInfo = candidates.map((el) => {
          const text = el.innerText?.trim().slice(0, 200) || "";
          const textLength = text.length;

          const hasImage = !!el.querySelector("img");
          const imageCount = el.querySelectorAll("img").length;

          const linkEl = el.tagName === "A" ? el : el.querySelector("a[href]");
          const hasLink = !!linkEl;
          const link = linkEl ? linkEl.href : null;
          const linkCount = el.querySelectorAll("a[href]").length;

          const childCount = el.children.length;
          const siblingCount = el.parentElement
            ? el.parentElement.children.length
            : 0;

          const rect = el.getBoundingClientRect();
          const width = rect.width;
          const height = rect.height;
          const area = width * height;

          const x = rect.x;
          const y = rect.y;

          const isClickable =
            el.tagName === "A" ||
            el.onclick != null ||
            el.getAttribute("role") === "button";

          const visible = isVisible(el);

          return {
            tag: el.tagName.toLowerCase(),
            text,
            textLength,
            hasImage,
            imageCount,
            hasLink,
            link,
            linkCount,
            childCount,
            siblingCount,
            width,
            height,
            area,
            x,
            y,
            isClickable,
            visible,
          };
        });
        const finalCandidates = candidateInfo.filter((el) => el.visible);
        return { data: finalCandidates };
      });

      const itemsWithId = elements.data.map((el, idx) => ({
        id: `${i}_${idx}`,
        ...el,
      }));
      const predictions = await predictProductCards(itemsWithId);
      const productCards = predictions.filter((p) => p.prediction === 1);

      const productUrls = productCards
        .map((p) => {
          const original = itemsWithId.find((el) => el.id === p.id);
          return original?.link;
        })
        .filter(Boolean);
      allStoresData.push({
        store: STORE_URLS[i],
        count: productUrls.length,
        links: productUrls,
      });
      const filePath = path.join("data", "product_urls.json");
      await fs.writeFile(filePath, JSON.stringify(allStoresData, null, 2));
      await page.close();
    } catch (error) {
      console.log(error);
      await page.close();
    }
  }

  // Run for only 2 Product URLS per store for prototype
  for (const storeData of allStoresData) {
    const { store, links } = storeData;
    console.log(`[INFO]: Processing store ${store}`);
    const page = await context.newPage();

    const urlsToProcess = links.slice(0, 2);
    let count = 0;
    for (const url of urlsToProcess) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      await page.evaluate((selectors) => {
        selectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => el.remove());
        });
      }, NAVBAR_CANDIDATES);

      const html = await page.evaluate(() => {
        return document.body.innerHTML;
      });
      const debugPath = path.join("data/debug", `debug_${count}.html`);
      await fs.writeFile(debugPath, html);

      const elements = await page.evaluate(async (selectors) => {
        const observed = new Set();
        const forms = Array.from(
          document.querySelectorAll(
            "form[action*='/cart/add'], form[data-product-form]",
          ),
        );
        const root = forms.length > 0 ? forms[0] : document;

        const allNodes = selectors.flatMap((selector) =>
          Array.from(root.querySelectorAll(selector)),
        );

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                observed.add(entry.target);
              }
            });
          },
          { threshold: [0.6] },
        );

        allNodes.forEach((el) => observer.observe(el));
        await new Promise((resolve) => setTimeout(resolve, 300));

        observer.disconnect();
        allNodes.forEach((el) => {
          if (!observed.has(el)) {
            el.remove();
          }
        });

        return selectors.flatMap((selector) => {
          const nodes = Array.from(root.querySelectorAll(selector));
          return nodes
            .map((element) => {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();

              const isVisible =
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0";
              if (!isVisible) return null;

              const hasDirectImage =
                element.tagName === "IMG" || element.tagName === "SVG";
              const hasChildImage =
                element.querySelector('img, svg, [role="img"]') !== null;
              const hasBackgroundImage =
                window.getComputedStyle(element).backgroundImage !== "none";

              const isNativeClickable = [
                "A",
                "BUTTON",
                "INPUT",
                "SELECT",
                "TEXTAREA",
              ].includes(element.tagName);
              const hasClickableRole = [
                "button",
                "link",
                "checkbox",
                "radio",
                "menuitem",
                "option",
              ].includes(element.getAttribute("role"));
              const hasPointerCursor = style.cursor === "pointer";
              const isNotDisabled =
                !element.disabled &&
                element.getAttribute("aria-disabled") !== "true";
              const isClickable =
                (isNativeClickable || hasClickableRole || hasPointerCursor) &&
                isNotDisabled;

              const dataAttributes = Array.from(element.attributes)
                .filter((attr) => /^data-/.test(attr.name))
                .reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {});

              if (isVisible) {
                return {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  tagName: element.tagName,
                  parent: element.parentElement.tagName,
                  siblingCount: element.parentElement.children.length - 1,
                  childCount: element.childElementCount,
                  hasImage:
                    hasDirectImage || hasChildImage || hasBackgroundImage,
                  text: element.innerText,
                  isClickable,
                  dataAttributes,
                  classes: element.className,
                };
              }
              return null;
            })
            .filter((item) => item !== null);
        });
      }, VARIANT_CANDIDATES);

      const initialDataPath = path.join(
        "data/initial_data",
        `initial_data_${count}.json`,
      );
      await fs.writeFile(initialDataPath, JSON.stringify(elements, null, 2));

      const clusters = await clusterProductVariants(elements);
      const cleanedClusters = dedupeClusters(clusters);

      for (const cluster of cleanedClusters) {
        for (const item of cluster) {
          await clickVariant(page, item);
          await page.waitForTimeout(500);
        }
      }

      const filePath = path.join(
        "data/product_variants",
        `page_${count}_variants.json`,
      );
      fs.writeFile(
        filePath,
        JSON.stringify({ url, clusters: cleanedClusters }, null, 2),
      );

      console.log(`Saved results for Page ${count} to ${filePath}`);
      count++;
    }
  }

  await browser.close();
}

main();
