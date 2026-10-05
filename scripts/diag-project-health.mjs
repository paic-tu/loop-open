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

async function tableInfo(name) {
  const exists = await run(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) as e`, [name]);
  if (!exists.rows[0].e) return { exists: false };
  const cols = await run(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [name]);
  const rls = await run(`SELECT relrowsecurity as rls FROM pg_class WHERE relname=$1`, [name]);
  const pols = await run(`
    SELECT polname, polcmd,
      pg_get_expr(polwithcheck, polrelid) as wc,
      pg_get_expr(polqual, polrelid) as us
    FROM pg_policy JOIN pg_class ON pg_policy.polrelid=pg_class.oid
    WHERE relname=$1
  `, [name]);
  const count = await run(`SELECT COUNT(*)::int as c FROM public.${name}`);
  return {
    exists: true,
    columns: cols.rows.length,
    columnList: cols.rows.map(c => c.column_name),
    rls: rls.rows[0]?.rls || false,
    policies: pols.rows.length,
    policyList: pols.rows.map(p => `${p.polcmd}:${p.polname}`),
    rows: count.rows[0].c,
  };
}

async function main() {
  await client.connect();
  console.log("=== Database health diagnostic ===\n");

  const tables = ["rfqs", "suppliers", "community_entities", "rfq_quotes", "approvals", "audit_logs", "user_terms_acceptances", "request_notes", "bookings", "library_files", "notifications", "profiles", "user_roles"];
  for (const t of tables) {
    const i = await tableInfo(t);
    if (!i.exists) {
      console.log(`  ${t.padEnd(30)} ❌ TABLE MISSING`);
    } else {
      console.log(`  ${t.padEnd(30)} ✅ cols=${String(i.columns).padEnd(3)} rows=${String(i.rows).padEnd(6)} RLS=${i.rls?"ON":"OFF"} policies=${i.policies}`);
    }
  }

  console.log("\n=== 2) Test users + their supplier/entity status ===");
  const users = await run(`
    SELECT u.email, ur.role,
      s.id as sup_id, s.status as sup_status, s.is_verified as sup_verified, s.verified_at as sup_vat,
      ce.id as ce_id, ce.status as ce_status, ce.verified_at as ce_vat
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON ur.user_id=u.id
    LEFT JOIN public.suppliers s ON s.user_id=u.id
    LEFT JOIN public.community_entities ce ON ce.user_id=u.id
    WHERE u.email IN ('admin@open-loopsa.com','staff@open-loopsa.com','user@open-loopsa.com')
    ORDER BY u.email
  `);
  for (const r of users.rows) {
    console.log("  ", r.email, "role=", r.role, "supplier=", r.sup_id ? `${r.sup_status}/${r.sup_verified}` : "—", "entity=", r.ce_id? `${r.ce_status}`:"—");
  }

  console.log("\n=== 3) Published RFQs (opportunities available for quoting) ===");
  const rfq = await run(`SELECT id, title, status, is_open, deadline, approved_at, published_at FROM public.rfqs WHERE status='published'`);
  console.log("  Count:", rfq.rows.length);
  for (const r of rfq.rows) console.log(`    • ${r.title.slice(0,55)} | deadline=${r.deadline} open=${r.is_open} apvd=${!!r.approved_at} pub=${!!r.published_at}`);

  console.log("\n=== 4) RFQ quotes last 3 ===");
  const lastQuotes = await run(`
    SELECT q.id, q.status, q.supplier_name, q.amount, q.created_at,
           u.email as user_email, rfq.title as rfq_title
    FROM public.rfq_quotes q
    LEFT JOIN auth.users u ON u.id = COALESCE(q.supplier_id, q.user_id)
    LEFT JOIN public.rfqs rfq ON rfq.id = q.rfq_id
    ORDER BY q.created_at DESC
    LIMIT 3
  `);
  for (const r of lastQuotes.rows) console.log(`    #${r.id.slice(0,6)}… ${r.status} ${r.supplier_name?.slice(0,20)} ${r.amount} on [${r.rfq_title?.slice(0,35)}] by ${r.user_email}`);

  console.log("\n=== 5) Pending approvals queue for admin ===");
  const pending = await run(`
    SELECT a.entity_type, a.entity_id, a.status as approval_status, a.created_at,
      COALESCE(ce.company_name, s.company_name, rfq.title) as name
    FROM public.approvals a
    LEFT JOIN public.community_entities ce ON a.entity_type='community_entity' AND ce.id=a.entity_id
    LEFT JOIN public.suppliers s ON a.entity_type='supplier' AND s.id=a.entity_id
    LEFT JOIN public.rfqs rfq ON a.entity_type='rfq' AND rfq.id=a.entity_id
    WHERE a.status='pending'
    ORDER BY a.created_at DESC
  `);
  console.log("  Pending count:", pending.rows.length);
  for (const r of pending.rows) console.log(`    ${r.entity_type.padEnd(18)} ${r.approval_status.padEnd(8)} ${String(r.name).slice(0,50)}`);

  console.log("\n=== 6) Recent audit log (last 5) ===");
  const audit = await run(`SELECT action, entity_type, actor_id, created_at FROM public.audit_logs ORDER BY created_at DESC LIMIT 5`);
  for (const r of audit.rows) console.log(`    ${r.created_at.toISOString().slice(5,16)} ${r.action.padEnd(22)} on ${r.entity_type}`);

  console.log("\n=== 7) Health check: Try simple INSERT/ROLLBACK on rfq_quotes as authenticated ===");
  // Use a published rfq id and admin user id
  const oneUser = (await run(`SELECT id FROM auth.users WHERE email='user@open-loopsa.com'`)).rows[0];
  const oneRfq = (await run(`SELECT id FROM public.rfqs WHERE status='published' LIMIT 1`)).rows[0];
  if (oneUser && oneRfq) {
    await run("SET ROLE authenticated");
    await run(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [oneUser.id]);
    // We can't easily do INSERT+ROLLBACK via simple queries in node-postgres because it auto-commits; instead skip.
    await run("RESET ROLE");
    console.log("  (skipped destructive test)");
  }

  console.log("\nDone ✅");
  await client.end();
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
