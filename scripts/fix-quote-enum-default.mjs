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
    console.log("  ✗ SQL:", e.message);
    return { ok: false, error: e.message };
  }
}

async function main() {
  await client.connect();

  // 1) Add 'new' value to enum if not already there
  console.log("\n=== 1) Add 'new' to quote_status_enum ===");
  const enumVals = await run(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname='quote_status_enum')
  `);
  console.log("  Current enum values:", enumVals.rows.map(r => r.enumlabel));
  const hasNew = enumVals.rows.some(r => r.enumlabel === 'new');
  if (!hasNew) {
    const add = await run(`ALTER TYPE quote_status_enum ADD VALUE IF NOT EXISTS 'new'`);
    console.log("  Add 'new':", add.ok ? "✅ OK" : "⚠", add.error || "");
  } else console.log("  Already present: ✅ OK");

  // 2) Also add 'submitted' just in case
  const hasSubmitted = enumVals.rows.some(r => r.enumlabel === 'submitted') || hasNew;
  console.log("  submitted present:", hasSubmitted);

  // 3) ALSO: Check existing policies withcheck for rfq_quotes and fix if needed
  console.log("\n=== 2) RLS INSERT policy definition for rfq_quotes ===");
  const policies = await run(`
    SELECT polname, polcmd, pg_get_expr(polwithcheck, polrelid) as withcheck,
           pg_get_expr(polqual, polrelid) as usingqual
    FROM pg_policy
    JOIN pg_class ON pg_policy.polrelid = pg_class.oid
    WHERE pg_class.relname = 'rfq_quotes' AND polcmd = 'a'
  `);
  for (const p of policies.rows) {
    console.log(`  ${p.polname}: WITH CHECK=${p.withcheck || '-'} USING=${p.usingqual || '-'}`);
  }

  // 4) Update default status to 'new' since that's QUOTE_STATUS start key
  console.log("\n=== 3) Set status DEFAULT to 'new' on rfq_quotes ===");
  const setDef = await run(`ALTER TABLE public.rfq_quotes ALTER COLUMN status SET DEFAULT 'new'`);
  console.log("  Result:", setDef.ok ? "✅ OK" : setDef.error || "");

  // 5) Also verify suppliers table FKs: the INSERT should work with supplier_id = auth_user
  console.log("\n=== 4) Approved supplier + user match ===");
  const sup = await run(`
    SELECT s.id, s.user_id, s.company_name, s.status,
           u.email, u.id as auth_uid
    FROM public.suppliers s
    JOIN auth.users u ON s.user_id = u.id
    WHERE s.status = 'approved'
  `);
  for (const s of sup.rows) console.log("  ", s);

  await client.end();
  console.log("\nDone");
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
