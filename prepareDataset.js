import fs from "fs";
import path from "path";

const DATA_DIR = "./data";
const OUTPUT_FILE = "./dataset.json";

const TAG_MAP = {
  div: 0,
  li: 1,
  article: 2,
  a: 3,
};

const files = fs.readdirSync(DATA_DIR);

let dataset = [];

for (const file of files) {
  const data = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, file), "utf-8")
  );

  data.forEach((item) => {
    if (item.label === undefined) return; // skip unlabeled

    const features = [
      TAG_MAP[item.tag] ?? -1,

      item.textLength,

      item.hasImage ? 1 : 0,
      item.imageCount,

      item.hasLink ? 1 : 0,
      item.linkCount,

      item.childCount,
      item.siblingCount,

      item.width,
      item.height,
      item.area,

      item.x,
      item.y,

      item.isClickable ? 1 : 0,
    ];

    dataset.push({
      features,
      label: item.label,
    });
  });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));

console.log(`Dataset saved: ${dataset.length} samples`);