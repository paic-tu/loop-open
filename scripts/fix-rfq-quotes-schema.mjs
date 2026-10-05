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
    console.log("  ✗ SQL failed:", e.message, e.detail || "");
    return { ok: false, error: e.message, detail: e.detail };
  }
}

async function main() {
  await client.connect();
  console.log("Connected");

  const steps = [
    {
      name: "Drop NOT NULL on price",
      sql: "ALTER TABLE public.rfq_quotes ALTER COLUMN price DROP NOT NULL",
    },
    {
      name: "Drop NOT NULL on delivery_days",
      sql: "ALTER TABLE public.rfq_quotes ALTER COLUMN delivery_days DROP NOT NULL",
    },
    {
      name: "Add DEFAULT NOW() on created_at",
      sql: "ALTER TABLE public.rfq_quotes ALTER COLUMN created_at SET DEFAULT NOW()",
    },
    {
      name: "Add DEFAULT NOW() on updated_at",
      sql: "ALTER TABLE public.rfq_quotes ALTER COLUMN updated_at SET DEFAULT NOW()",
    },
    {
      name: "Add DEFAULT 'new' on status",
      sql: "ALTER TABLE public.rfq_quotes ALTER COLUMN status SET DEFAULT 'new'",
    },
    {
      name: "Add supplier_name column",
      sql: "ALTER TABLE public.rfq_quotes ADD COLUMN IF NOT EXISTS supplier_name text",
    },
    {
      name: "Add amount column (TEXT — code passes string)",
      sql: "ALTER TABLE public.rfq_quotes ADD COLUMN IF NOT EXISTS amount text",
    },
    {
      name: "Add duration column (TEXT)",
      sql: "ALTER TABLE public.rfq_quotes ADD COLUMN IF NOT EXISTS duration text",
    },
    {
      name: "Add contact column (TEXT)",
      sql: "ALTER TABLE public.rfq_quotes ADD COLUMN IF NOT EXISTS contact text",
    },
    {
      name: "Add note column (TEXT)",
      sql: "ALTER TABLE public.rfq_quotes ADD COLUMN IF NOT EXISTS note text",
    },
    {
      name: "Backfill: amount = price::text if null",
      sql: "UPDATE public.rfq_quotes SET amount = price::text WHERE amount IS NULL AND price IS NOT NULL",
    },
    {
      name: "Backfill: duration = delivery_days::text if null",
      sql: "UPDATE public.rfq_quotes SET duration = delivery_days::text || ' يوم' WHERE duration IS NULL AND delivery_days IS NOT NULL",
    },
    {
      name: "Backfill: note = notes if null",
      sql: "UPDATE public.rfq_quotes SET note = notes WHERE note IS NULL AND notes IS NOT NULL",
    },
    // Also make sure user_id FK nullable (if not already) since code passes supplier_id only
    {
      name: "Drop NOT NULL on user_id",
      sql: "ALTER TABLE public.rfq_quotes ALTER COLUMN user_id DROP NOT NULL",
    },
    // Also drop NOT NULL on technical_proposal / financial_proposal if any
    {
      name: "Drop NOT NULL on technical_proposal (if exists)",
      sql: "ALTER TABLE public.rfq_quotes ALTER COLUMN technical_proposal DROP NOT NULL",
      skipOnError: true,
    },
    {
      name: "Drop NOT NULL on financial_proposal (if exists)",
      sql: "ALTER TABLE public.rfq_quotes ALTER COLUMN financial_proposal DROP NOT NULL",
      skipOnError: true,
    },
  ];

  console.log("\n=== Applying schema fixes ===");
  for (const step of steps) {
    process.stdout.write(`  ${step.name}... `);
    const res = await run(step.sql);
    if (res.ok) {
      console.log("✅ OK");
    } else {
      if (step.skipOnError) console.log("⚠️ SKIPPED (ok)");
      else console.log("❌ FAILED");
    }
  }

  console.log("\n=== Verify NEW columns present ===");
  const colCheck = await run(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rfq_quotes'
    ORDER BY ordinal_position
  `);
  const expected = ["supplier_name", "amount", "duration", "contact", "note"];
  const actual = new Set(colCheck.rows.map(r => r.column_name));
  for (const e of expected) {
    console.log(`  ${e}: ${actual.has(e) ? "✅ PRESENT" : "❌ MISSING"}`);
  }

  console.log("\n=== Final full column list ===");
  for (const c of colCheck.rows) {
    console.log(`  ${c.column_name.padEnd(22)} ${c.data_type.padEnd(18)} NULL=${c.is_nullable.padEnd(4)} DEF=${c.column_default || '-'.slice(0,30)}`);
  }

  // Now try an actual RLS-aware insert
  console.log("\n=== TEST INSERT AS AUTHENTICATED (USER who is approved supplier) ===");
  const userRes = await run(`SELECT id FROM auth.users WHERE email='user@open-loopsa.com'`);
  const uid = userRes.rows[0].id;
  const rfqRes = await run(`SELECT id FROM public.rfqs WHERE status='published' LIMIT 1`);
  const rfqId = rfqRes.rows[0]?.id;
  if (uid && rfqId) {
    // Use DO block with single statement workaround
    await run(`SET ROLE authenticated`);
    const setSub = await run(`SELECT set_config('request.jwt.claim.sub', $1, true) AS sub`, [uid]);
    console.log("  Authenticated set:", setSub.ok ? "OK sub=" + setSub.rows[0].sub : setSub.error);

    const now = new Date().toISOString();
    const ins = await run(`
      INSERT INTO public.rfq_quotes (rfq_id, supplier_id, supplier_name, amount, duration, contact, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, status, created_at
    `, [rfqId, uid, "شركة سماء لخدمات الأحداث (DIAG)", "15000 ريال", "14 يوم عمل", "0555555555", "عرض تشخيصي للاختبار فقط لا تعتمد"]);
    console.log(`  Insert result: ${ins.ok ? "✅ SUCCESS id=" + ins.rows[0].id + " status=" + ins.rows[0].status : "❌ FAIL: " + (ins.error || "") + (ins.detail ? " | DETAIL: " + ins.detail : "")}`);
  } else {
    console.log("  Skipped (missing user/rfq)");
  }

  await run("RESET ROLE");
  await client.end();
  console.log("\nDone");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
