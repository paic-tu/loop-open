import pg from "pg";
const { Client } = pg;
import { readFileSync } from "node:fs";
const env = readFileSync("./.env", "utf-8").split("\n").reduce((a, l) => {
  const [k, v] = l.split("=");
  if (k && v && !k.startsWith("#")) a[k.trim()] = v.trim().replace(/^['"]|['"]$/g, "");
  return a;
}, {});
const DIRECT_PW = process.argv[2] ?? env.SUPABASE_DIRECT_PW ?? env.DB_PASSWORD;
const client = new Client({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432, user: "postgres", database: "postgres",
  password: DIRECT_PW, ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  console.log("✅ Connected to DB");
  // 1) Check if table exists
  const { rows: tbl } = await client.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='request_notes') AS ex"
  );
  console.log("📊 request_notes table exists?", tbl[0].ex);
  // 2) Count rows
  const { rows: cnt } = await client.query("SELECT COUNT(*)::int AS n FROM public.request_notes");
  console.log("🧮 Total rows in request_notes:", cnt[0].n);
  // 3) Show rows
  const { rows: notes } = await client.query(
    "SELECT id, request_id, author_id, author_name, LEFT(content, 60) AS content_preview, created_at FROM public.request_notes ORDER BY created_at DESC"
  );
  for (const n of notes) {
    console.log(`  ┌ ID: ${n.id.slice(0,10)}…  Req: ${String(n.request_id).slice(0,10)}…  At: ${new Date(n.created_at).toLocaleString("ar-SA")}`);
    console.log(`  │ By: ${n.author_name} (${String(n.author_id ?? "NULL").slice(0,10)}…)`);
    console.log(`  └ Preview: ${n.content_preview}`);
    console.log();
  }
  process.exit(0);
} catch (e) {
  console.error("❌ DB ERROR:", e.message || e);
  process.exit(1);
} finally { try { await client.end(); } catch {} }
