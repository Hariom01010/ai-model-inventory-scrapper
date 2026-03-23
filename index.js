import { STORE_URLS } from "./constants.js";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRODUCT_VARIANT_DIR = path.join(__dirname, "data/product_variants");
if (!fs.existsSync(PRODUCT_VARIANT_DIR)) {
  fs.mkdirSync(PRODUCT_VARIANT_DIR);
}
const LOG_FILE = path.join(__dirname, "crawler.log");

function log(message) {
  const time = new Date().toISOString();
  const finalMessage = `[${time}] ${message}\n`;

  fs.appendFileSync(LOG_FILE, finalMessage);
}

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

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const DATA_DIR = path.join(__dirname, "data");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }

  const TEST_DATA_DIR = path.join(__dirname, "test_data");
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR);
  }

  let count = 0;
  for (let i = 0; i < STORE_URLS.length; i++) {
    const page = await context.newPage();
    page.on("console", (msg) => {
      log(`[BROWSER]: ${msg.text()}`);
    });
    try {
      console.log(`[INFO]: VISITIN ${STORE_URLS[i]}`);
      await page.goto(STORE_URLS[i], { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const elements = await page.evaluate(() => {
        const logs = [];

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

        logs.push(`TOTAL candidates: ${candidates.length}`);

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

        logs.push(`After map: ${candidateInfo.length}`);
        logs.push(`visible: ${candidateInfo.filter((e) => e.visible).length}`);

        const finalCandidates = candidateInfo.filter((el) => el.visible);

        logs.push(`After filter: ${finalCandidates.length}`);

        return { logs, data: finalCandidates };
      });
      elements.logs.forEach((l) => log(`[PIPELINE]: ${l}`));

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

      // taking 5 products from each url
      const minProductUrl = Math.min(productUrls.length, 5);
      for (let j = 0; j < minProductUrl; j++) {
        const page = await context.newPage();
        await page.goto(productUrls[j], { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        const variantElements = await page.evaluate(() => {
          const logs = [];

          const isVisible = (el) => {
            return (
              el.offsetWidth > 0 &&
              el.offsetHeight > 0 &&
              el.getClientRects().length > 0
            );
          };

          const variantCandidates = Array.from(
            document.querySelectorAll(
              `button,
              input[type="radio"],
              input[type="button"],
              label,
              select option,
              li,
              [role="option"],
              [role="radio"],
              [class*="variant"],
              [class*="option"],
              [class*="swatch"],
              [class*="size"],
              [class*="color"],
              div,
              span`,
            ),
          );

          logs.push(`Total variant candidates: ${variantCandidates.length}`);

          const candidateInfo = variantCandidates.map((el, idx) => {
            const text = (el.innerText || "").trim().slice(0, 100);
            const rect = el.getBoundingClientRect();

            const isClickable =
              el.tagName === "BUTTON" ||
              el.onclick != null ||
              el.getAttribute("role") === "button" ||
              window.getComputedStyle(el).cursor === "pointer";

            const classes =
              typeof el.className === "string"
                ? el.className.toLowerCase()
                : (el.getAttribute("class") || "").toLowerCase();

            return {
              id: idx,
              tag: el.tagName.toLowerCase(),
              visible: isVisible(el) ? 1 : 0,
              text,
              textLength: text.length,
              isClickable,
              childCount: el.children.length,
              siblingCount: el.parentElement
                ? el.parentElement.children.length
                : 0,
              class_contains_variant: classes.includes("variant") ? 1 : 0,
              class_contains_option: classes.includes("option") ? 1 : 0,
              class_contains_size: classes.includes("size") ? 1 : 0,
              class_contains_color: classes.includes("color") ? 1 : 0,
              class_contains_swatch: classes.includes("swatch") ? 1 : 0,
              isSingleWord: text.split(" ").length === 1 ? 1 : 0,
              isShortText: text.length > 0 && text.length <= 5 ? 1 : 0,
              width: rect.width,
              height: rect.height,
              area: rect.width * rect.height,
              parentId: el.parentElement
                ? el.parentElement.tagName +
                  "_" +
                  el.parentElement.children.length
                : null,
            };
          });

          logs.push(`After map: ${candidateInfo.length}`);
          logs.push(
            `visible: ${candidateInfo.filter((e) => e.visible).length}`,
          );

          const finalCandidates = candidateInfo.filter((el) => el.visible);

          logs.push(`After filter: ${finalCandidates.length}`);
          return { logs, data: finalCandidates };
        });

        const filePath = path.join(
          PRODUCT_VARIANT_DIR,
          `product_${count}.json`,
        );
        fs.writeFileSync(
          filePath,
          JSON.stringify(variantElements.data, null, 2),
        );
        count++;
        console.log(`[INFO]: Saved variant data → ${filePath}`);
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
