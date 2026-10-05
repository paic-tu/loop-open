// Quick dedup: remove duplicate impact stats & partners (keep earliest by id)
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

// 1) Impact stats: dedupe by (title, stat_value) keeping the min(id)
console.log("Before dedupe: cms_impact_stats =", (await c.query(`SELECT COUNT(*) FROM public.cms_impact_stats`)).rows[0].count);
await c.query(`
  DELETE FROM public.cms_impact_stats t
  USING (
    SELECT title, stat_value, MIN(id) AS keep
    FROM public.cms_impact_stats GROUP BY title, stat_value HAVING COUNT(*) > 1
  ) x
  WHERE t.title = x.title AND t.stat_value = x.stat_value AND t.id <> x.keep
`);
console.log("After dedupe : cms_impact_stats =", (await c.query(`SELECT COUNT(*) FROM public.cms_impact_stats`)).rows[0].count);

// 2) Partners: dedupe by (name) keeping min(id)
console.log("Before dedupe: cms_partners     =", (await c.query(`SELECT COUNT(*) FROM public.cms_partners`)).rows[0].count);
await c.query(`
  DELETE FROM public.cms_partners t
  USING (
    SELECT name, MIN(id) AS keep FROM public.cms_partners GROUP BY name HAVING COUNT(*) > 1
  ) x
  WHERE t.name = x.name AND t.id <> x.keep
`);
console.log("After dedupe : cms_partners     =", (await c.query(`SELECT COUNT(*) FROM public.cms_partners`)).rows[0].count);

// 3) Service items: dedupe by (category_id, title, sort_order) keeping min(id)
console.log("Before dedupe: cms_service_items =", (await c.query(`SELECT COUNT(*) FROM public.cms_service_items`)).rows[0].count);
await c.query(`
  DELETE FROM public.cms_service_items t
  USING (
    SELECT category_id, title, sort_order, MIN(id) AS keep
    FROM public.cms_service_items GROUP BY category_id, title, sort_order HAVING COUNT(*) > 1
  ) x
  WHERE t.category_id = x.category_id AND t.title = x.title AND t.sort_order = x.sort_order AND t.id <> x.keep
`);
console.log("After dedupe : cms_service_items =", (await c.query(`SELECT COUNT(*) FROM public.cms_service_items`)).rows[0].count);

// 4) Package tiers: dedupe by (package_id, label, sort_order) keeping min(id)
console.log("Before dedupe: cms_package_tiers =", (await c.query(`SELECT COUNT(*) FROM public.cms_package_tiers`)).rows[0].count);
await c.query(`
  DELETE FROM public.cms_package_tiers t
  USING (
    SELECT package_id, label, sort_order, MIN(id) AS keep
    FROM public.cms_package_tiers GROUP BY package_id, label, sort_order HAVING COUNT(*) > 1
  ) x
  WHERE t.package_id = x.package_id AND t.label = x.label AND t.sort_order = x.sort_order AND t.id <> x.keep
`);
console.log("After dedupe : cms_package_tiers =", (await c.query(`SELECT COUNT(*) FROM public.cms_package_tiers`)).rows[0].count);

c.end();
console.log("\n✅ Dedup complete. CMS content now clean.");
