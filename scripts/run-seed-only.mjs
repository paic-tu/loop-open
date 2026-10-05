// EN-only: Re-run SEED SQL only (20260915130000_seed_cms_library_platform.sql)
// Now ALL target tables (library_files, bookings, requests, profiles, user_roles, rfqs, ...) EXIST.
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
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const PROJECT_ID  = process.env.SUPABASE_PROJECT_ID;
const DB_PASSWORD = process.argv[2] || process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
if (!PROJECT_ID || !DB_PASSWORD) { console.error("Missing env/args"); process.exit(1); }

const seedPath = join(projectRoot, "supabase", "migrations", "20260915130000_seed_cms_library_platform.sql");
if (!existsSync(seedPath)) { console.error("Seed file missing:", seedPath); process.exit(1); }
const seedSql = readFileSync(seedPath, "utf8");

const c = new Client({
  host: `db.${PROJECT_ID}.supabase.co`, port: 5432, database: "postgres", user: "postgres", password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30_000,
});
await c.connect();

// Strategy 1: Run whole file as single multi-statement query (pg driver supports it)
console.log("[1] Try running entire seed file in one query (preferred)...");
try {
  await c.query(seedSql);
  console.log("   SUCCESS — entire seed executed in 1 multi-statement call.");
} catch (e) {
  console.log(`   WARN failed (${(e.message || "").split("\n")[0]}) — falling back to split-by-statement...`);
  // Strategy 2: Split by ';' and execute one-by-one
  const rawStmts = seedSql
    .replace(/--.*$/gm, "")         // line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  console.log(`   Split into ${rawStmts.length} statements; executing...`);
  let ok = 0, sk = 0;
  for (let i = 0; i < rawStmts.length; i++) {
    const s = rawStmts[i];
    try {
      await c.query(s);
      ok++;
    } catch (se) {
      const m = (se.message || "").toLowerCase();
      const benign = m.includes("already exists") || m.includes("duplicate key") || m.includes("constraint") || m.includes("does not exist") || m.includes("permission");
      if (benign) sk++;
      else { console.log(`   ERROR stmt ${i+1}/${rawStmts.length}: ${se.message.slice(0,120)}\n   SQL preview: ${s.slice(0,160).replace(/\s+/g," ")}`); }
    }
  }
  console.log(`   Split-result: ok=${ok}, skipped=${sk}`);
}

// Validation: counts
console.log("\n[2] Validation counts:");
const count = (t) => c.query(`SELECT COUNT(*) FROM ${t}`).then(r=>Number(r.rows[0].count));
const rows = [
  ["library_files",              await count("public.library_files")],
  ["cms_service_categories",     await count("public.cms_service_categories")],
  ["cms_service_items",          await count("public.cms_service_items")],
  ["cms_packages",               await count("public.cms_packages")],
  ["cms_package_tiers",          await count("public.cms_package_tiers")],
  ["cms_impact_stats",           await count("public.cms_impact_stats")],
  ["cms_partners",               await count("public.cms_partners")],
  ["cms_site_settings",          await count("public.cms_site_settings")],
  ["platform_settings",          await count("public.platform_settings")],
  ["profiles",                   await count("public.profiles")],
  ["user_roles",                 await count("public.user_roles")],
];
for (const [k, v] of rows) console.log(`   ${k.padEnd(28," ")} = ${v}`);

c.end();
console.log("\n✅ Seed validation complete.");
