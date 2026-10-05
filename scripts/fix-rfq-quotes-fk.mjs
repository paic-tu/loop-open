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
    console.log("  ✗", e.message);
    return { ok: false, error: e.message };
  }
}

async function main() {
  await client.connect();

  console.log("=== 1) Find and drop broken FK rfq_quotes_supplier_id_fkey ===");
  const fks = await run(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.rfq_quotes'::regclass
    AND contype = 'f'
  `);
  for (const f of fks.rows) console.log(`  FK found: ${f.conname} = ${f.def}`);

  const badFK = fks.rows.find(f => f.conname === 'rfq_quotes_supplier_id_fkey' || /supplier_id/.test(f.def));
  if (badFK) {
    const res = await run(`ALTER TABLE public.rfq_quotes DROP CONSTRAINT ${badFK.conname}`);
    console.log(`  Dropped ${badFK.conname}:`, res.ok ? "✅" : "⚠", res.error || "");
  }

  console.log("\n=== 2) Drop rfq_quotes_user_id_fkey if exists (we don't want both, keep clean) ===");
  const userFK = fks.rows.find(f => /user_id/.test(f.conname) || /REFERENCES auth/.test(f.def) || /REFERENCES users/.test(f.def));
  if (userFK) {
    const res = await run(`ALTER TABLE public.rfq_quotes DROP CONSTRAINT ${userFK.conname}`);
    console.log(`  Dropped ${userFK.conname}:`, res.ok ? "✅" : "⚠", res.error || "");
  }

  console.log("\n=== 3) Add a CLEAN FK supplier_id → auth.users(id) ===");
  // Note: auth.users is in auth schema not public
  const addAuthFK = await run(`
    ALTER TABLE public.rfq_quotes
    ADD CONSTRAINT rfq_quotes_supplier_auth_fkey
    FOREIGN KEY (supplier_id) REFERENCES auth.users(id) ON DELETE SET NULL
  `);
  console.log("  FK supplier→auth.users:", addAuthFK.ok ? "✅ OK" : "⚠ " + (addAuthFK.error || ""));

  // Also add a FK rfq_id → public.rfqs(id) if not exists
  console.log("\n=== 4) Ensure FK rfq_quotes.rfq_id → rfqs.id ===");
  const hasRfqFK = fks.rows.some(f => /rfq_id/.test(f.def) && /rfqs/.test(f.def));
  if (!hasRfqFK) {
    const fk2 = await run(`
      ALTER TABLE public.rfq_quotes
      ADD CONSTRAINT rfq_quotes_rfq_fkey
      FOREIGN KEY (rfq_id) REFERENCES public.rfqs(id) ON DELETE CASCADE
    `);
    console.log("  FK rfq→rfqs:", fk2.ok ? "✅ OK" : "⚠ " + (fk2.error || ""));
  } else console.log("  Already exists: ✅ OK");

  console.log("\n=== 5) Final FK list ===");
  const fks2 = await run(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.rfq_quotes'::regclass AND contype='f'
  `);
  for (const f of fks2.rows) console.log("  -", f.conname, "=", f.def);

  console.log("\n=== 6) TEST INSERT again (Approved supplier user@open-loopsa.com) ===");
  const uidRow = await run(`SELECT id FROM auth.users WHERE email='user@open-loopsa.com'`);
  const uid = uidRow.rows[0]?.id;
  const rfqRow = await run(`SELECT id FROM public.rfqs WHERE status='published' LIMIT 1`);
  const rfqId = rfqRow.rows[0]?.id;
  if (uid && rfqId) {
    // Also pass user_id = uid to make double-sure all patterns covered
    const ins = await run(`
      INSERT INTO public.rfq_quotes
        (rfq_id, supplier_id, user_id, supplier_name, amount, duration, contact, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, status, supplier_id, user_id, created_at, amount
    `, [rfqId, uid, uid, "شركة سماء (DIAG3)", "35000 ريال", "14 يوم عمل", "0501234567", "اختبار ثالث بعد إصلاح FK"]);
    console.log(`  Result: ${ins.ok ? "✅ SUCCESS id="+ins.rows[0].id : "❌ FAIL: " + ins.error}`);
    if (ins.ok) {
      console.log("    Row:", JSON.stringify(ins.rows[0]));
      const del = await run(`DELETE FROM public.rfq_quotes WHERE id=$1`, [ins.rows[0].id]);
      console.log("    Test row cleanup:", del.ok ? "OK" : del.error);
    }
  }

  // 7) Bonus: Also adjust QuoteDialog TS code to also pass user_id alongside supplier_id (double-assurance)
  // We'll do this via Edit tool on RfqBoard.tsx
  await client.end();
  console.log("\nDB-level fixes COMPLETE. Now code tweak on QuoteDialog + real browser test.");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
