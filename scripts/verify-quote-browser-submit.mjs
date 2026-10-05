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
    return { ok: false, error: e.message };
  }
}

async function main() {
  await client.connect();
  const uid = (await run(`SELECT id FROM auth.users WHERE email='user@open-loopsa.com'`)).rows[0]?.id;
  console.log("Test user id:", uid);

  console.log("\n=== 1) rfq_quotes rows owned by this user (newest first) ===");
  const q = await run(`
    SELECT id, rfq_id, supplier_id, user_id, supplier_name, amount, duration, contact, note, status, created_at
    FROM public.rfq_quotes
    WHERE supplier_id = $1 OR user_id = $1
    ORDER BY created_at DESC
    LIMIT 5
  `, [uid]);
  for (const r of q.rows) {
    console.log(JSON.stringify(r, null, 2));
  }
  console.log("Total found:", q.rows.length);

  console.log("\n=== 2) user_terms_acceptances for this user (quote action) ===");
  const uta = await run(`
    SELECT id, terms_version, acceptance_type, related_action, related_id, created_at
    FROM public.user_terms_acceptances
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 5
  `, [uid]);
  for (const r of uta.rows) console.log("  -", JSON.stringify(r));

  console.log("\n=== 3) audit_logs for this user quote.submitted action ===");
  const audit = await run(`
    SELECT id, actor_id, action, entity_type, entity_id, meta, created_at
    FROM public.audit_logs
    WHERE actor_id = $1 AND action = 'quote.submitted'
    ORDER BY created_at DESC
    LIMIT 5
  `, [uid]);
  for (const r of audit.rows) console.log("  -", JSON.stringify(r));

  await client.end();
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
