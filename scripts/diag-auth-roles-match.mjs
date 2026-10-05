import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const envPath = join(rootDir, ".env");
const envVars = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const idx = s.indexOf("=");
    if (idx < 0) continue;
    const k = s.slice(0, idx).trim();
    const v = s.slice(idx + 1).trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    envVars[k] = v;
  }
}

const DB_PASSWORD = process.argv[2] || envVars.DB_PASSWORD || "9A182SlQ0Zfo1yRX";

async function main() {
  const client = new Client({
    host: envVars.SUPABASE_DIRECT_HOST || "db.berprxhuguniggtnerfq.supabase.co",
    port: 5432,
    user: "postgres",
    database: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 10000,
  });
  await client.connect();

  console.log("--- auth.users (first 5) ---");
  const auth = await client.query(`SELECT id, email, created_at FROM auth.users ORDER BY created_at ASC LIMIT 10`);
  for (const row of auth.rows) console.log(`  id=${row.id}  email=${row.email}`);

  console.log("\n--- public.user_roles ---");
  const roles = await client.query(`SELECT user_id, role, created_at FROM public.user_roles ORDER BY created_at ASC LIMIT 10`);
  for (const row of roles.rows) console.log(`  user_id=${row.user_id}  role=${row.role}`);

  console.log("\n--- public.profiles ---");
  const prof = await client.query(`SELECT id, full_name, email FROM public.profiles ORDER BY created_at ASC LIMIT 10`);
  for (const row of prof.rows) console.log(`  id=${row.id}  name=${row.full_name}`);

  console.log("\n--- Join: auth.users LEFT JOIN user_roles ---");
  const join = await client.query(`
    SELECT u.id, u.email, ur.role
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    ORDER BY u.created_at ASC
  `);
  for (const row of join.rows) console.log(`  uid=${row.id}  email=${row.email}  role=${row.role ?? "<NULL>"}`);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
