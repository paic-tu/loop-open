import pg from "pg";
const { Client } = pg;

const password = process.argv[2] || "9A182SlQ0Zfo1yRX";

const client = new Client({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

async function run(sql, params = []) {
  try {
    const res = await client.query(sql, params);
    return { ok: true, rows: res.rows, rowCount: res.rowCount };
  } catch (e) {
    return { ok: false, error: e.message, detail: e.detail };
  }
}

async function main() {
  await client.connect();

  // 1) Check suppliers statuses
  console.log("\n=== SUPPLIERS STATUS ===");
  const sup = await run(`
    SELECT id, company_name, status, is_verified, verified_at, document_status, document_status_updated_at
    FROM public.suppliers
    ORDER BY created_at DESC
  `);
  for (const s of sup.rows) console.log(JSON.stringify(s));

  // 2) Check RFQs statuses
  console.log("\n=== RFQs STATUS ===");
  const rfq = await run(`
    SELECT id, title, status, approved_at, published_at, rejected_at, is_open
    FROM public.rfqs
    ORDER BY created_at DESC
  `);
  for (const r of rfq.rows) console.log(JSON.stringify(r));

  // 3) Check approvals table - latest 5
  console.log("\n=== APPROVALS LATEST 5 ===");
  const app = await run(`
    SELECT id, entity_type, entity_id::text, status, reviewer_id::text, reviewed_at
    FROM public.approvals
    ORDER BY created_at DESC LIMIT 5
  `);
  for (const a of app.rows) console.log(JSON.stringify(a));

  // 4) Check audit_logs - latest 5
  console.log("\n=== AUDIT LOGS LATEST 5 ===");
  const audit = await run(`
    SELECT id, action, entity_type, entity_id::text, actor_id::text, created_at
    FROM public.audit_logs
    ORDER BY created_at DESC LIMIT 5
  `);
  for (const a of audit.rows) console.log(JSON.stringify(a));

  // 5) Community entities - final statuses
  console.log("\n=== COMMUNITY ENTITIES STATUS ===");
  const ce = await run(`
    SELECT id, entity_name, status, is_verified, verified_at, document_status
    FROM public.community_entities
    ORDER BY created_at DESC
  `);
  for (const c of ce.rows) console.log(JSON.stringify(c));

  await client.end();
  console.log("\nDone");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
