import { STORE_URLS, VARIANT_CANDIDATES } from "./constants.js";
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

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

  let count = 0;
  for (let i = 0; i < STORE_URLS.length; i++) {
    const page = await context.newPage();
    try {
      console.log(`[INFO]: Visiting ${STORE_URLS[i]}`);
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

      console.log("[INFO]: Product URLs:", productUrls);
      console.log(`[INFO]: Found ${productCards.length} product cards`);

      for (let j = 0; j < 3; j++) {
        const page = await context.newPage();
        await page.goto(productUrls[j], { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        const elements = await page.evaluate((selectors) => {
          return selectors.flatMap((selector) => {
            const nodes = Array.from(document.querySelectorAll(selector));

            return nodes
              .map((element) => {
                const rect = element.getBoundingClientRect();

                const hasSize = rect.width > 0 && rect.height > 0;
                const isInViewport =
                  rect.top >= 0 &&
                  rect.left >= 0 &&
                  rect.bottom <=
                    (window.innerHeight ||
                      document.documentElement.clientHeight) &&
                  rect.right <=
                    (window.innerWidth || document.documentElement.clientWidth);
                const style = window.getComputedStyle(element);
                const isVisible =
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  style.opacity !== "0";

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

                if (isInViewport && isVisible && hasSize) {
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
                  };
                }
                return null;
              })
              .filter((item) => item !== null);
          });
        }, VARIANT_CANDIDATES);
        
        const clusters = await clusterProductVariants(elements);
        console.log("RAW RESPONSE:", clusters);
        const filePath = path.join(
          "train_data/product_variants",
          `page_${count}_variants.json`,
        );
        const dataToSave = {
          url: productUrls[j],
          clusters: clusters,
        }; 

        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
        console.log(`Saved results for Page ${count} to ${filePath}`);
        count++;
        await page.close();
      }
    } catch (e) {
      console.log(e);
      console.log(`[ERROR]: Error executing ${i}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

main();
