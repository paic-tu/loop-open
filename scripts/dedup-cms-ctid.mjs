// Dedup via ctid (standard postgres dedup idiom — no MIN(uuid) needed)
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const envPath = join(projectRoot, ".env");

if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("="); if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
const PROJECT_ID  = process.env.SUPABASE_PROJECT_ID;
const DB_PASSWORD = process.argv[2] || process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
if (!PROJECT_ID || !DB_PASSWORD) { console.error("missing env"); process.exit(1); }

const c = new Client({
  host: `db.${PROJECT_ID}.supabase.co`, port: 5432, database: "postgres", user: "postgres", password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30_000,
});
await c.connect();

const showCount = (t) => c.query(`SELECT COUNT(*) FROM ${t}`).then(r=>Number(r.rows[0].count));

async function dedup(table, groupCols) {
  const before = await showCount(table);
  // Classic postgres ctid dedup: keep the row with smallest ctid per group
  const sql = `
    DELETE FROM ${table} t
    USING ${table} t2
    WHERE t.ctid > t2.ctid
      AND ${groupCols.map(g=>`(t.${g}::text = t2.${g}::text OR (t.${g} IS NULL AND t2.${g} IS NULL))`).join(" AND ")}
  `;
  await c.query(sql);
  const after = await showCount(table);
  console.log(`   ${table.padEnd(28," ")}: ${before} -> ${after}  (removed ${before-after})`);
}

console.log("Dedup runs:\n");
await dedup("public.cms_impact_stats",    ["title", "stat_value"]);
await dedup("public.cms_partners",        ["name"]);
await dedup("public.cms_service_items",   ["category_id", "title", "sort_order"]);
await dedup("public.cms_package_tiers",   ["package_id", "label", "sort_order"]);

console.log("\nFinal counts:");
for (const t of [
  "public.library_files","public.cms_service_categories","public.cms_service_items",
  "public.cms_packages","public.cms_package_tiers","public.cms_impact_stats",
  "public.cms_partners","public.cms_site_settings","public.platform_settings",
  "public.profiles","public.user_roles"
]) {
  const n = await showCount(t);
  console.log(`   ${t.replace("public.","").padEnd(28," ")} = ${n}`);
}

c.end();
console.log("\n✅ CMS dedup complete.");
