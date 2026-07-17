/**
 * Tiny JSON-file persistence. Volumes here are small (a few brands, each
 * with a handful of collections of ~50 products), so a single JSON document
 * with atomic writes is plenty for this stage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY = { brands: [], collections: [], snapshots: {} };

function load() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`[db] Could not read ${DB_FILE}, starting empty:`, error.message);
    }
    return structuredClone(EMPTY);
  }
}

export const db = load();

export function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}
