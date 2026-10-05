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

async function checkTableExists(name) {
  const res = await run(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) as exists
  `, [name]);
  return res.rows[0]?.exists || false;
}

async function checkColumns(tableName, requiredCols) {
  const res = await run(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  const actual = new Set(res.rows.map(r => r.column_name));
  const missing = requiredCols.filter(c => !actual.has(c));
  return { actual: res.rows, missing, allPresent: missing.length === 0 };
}

async function checkRLS(tableName) {
  const rls = await run(`
    SELECT relrowsecurity as rls_enabled
    FROM pg_class WHERE relname = $1
  `, [tableName]);
  const policies = await run(`
    SELECT polname, polcmd, polroles, polqual IS NOT NULL as has_qual, polwithcheck IS NOT NULL as has_withcheck
    FROM pg_policy
    JOIN pg_class ON pg_policy.polrelid = pg_class.oid
    WHERE pg_class.relname = $1
    ORDER BY polcmd, polname
  `, [tableName]);
  return {
    rlsEnabled: rls.rows[0]?.rls_enabled || false,
    policies: policies.rows,
  };
}

async function main() {
  await client.connect();

  console.log("=== 1) CHECK TABLES EXIST ===");
  const tablesToCheck = ["rfq_quotes", "user_terms_acceptances", "contracts", "opportunity_questions", "opportunity_categories", "platform_settings"];
  for (const t of tablesToCheck) {
    const exists = await checkTableExists(t);
    console.log(`${t.padEnd(30)}: ${exists ? "✅ EXISTS" : "❌ MISSING"}`);
  }

  console.log("\n=== 2) REQUIRED COLUMNS FOR rfq_quotes ===");
  const rfqCols = await checkColumns("rfq_quotes", [
    "id", "rfq_id", "supplier_id", "supplier_name",
    "amount", "duration", "note", "contact", "status", "created_at"
  ]);
  console.log("Columns present:", rfqCols.actual.map(c => `${c.column_name}(${c.data_type})${c.is_nullable==='NO'?' NOT NULL':''}`).join(", "));
  if (rfqCols.missing.length) console.log("❌ MISSING:", rfqCols.missing.join(", "));
  else console.log("✅ All required columns present");

  console.log("\n=== 3) REQUIRED COLUMNS FOR user_terms_acceptances ===");
  const utaCols = await checkColumns("user_terms_acceptances", [
    "id", "user_id", "terms_version", "acceptance_type",
    "related_action", "related_id", "created_at"
  ]);
  console.log("Columns present:", utaCols.actual.map(c => `${c.column_name}(${c.data_type})${c.is_nullable==='NO'?' NOT NULL':''}`).join(", "));
  if (utaCols.missing.length) console.log("❌ MISSING:", utaCols.missing.join(", "));
  else console.log("✅ All required columns present");

  console.log("\n=== 4) RLS & POLICIES FOR rfq_quotes ===");
  const rfqRLS = await checkRLS("rfq_quotes");
  console.log("RLS enabled:", rfqRLS.rlsEnabled);
  console.log("Policies:", rfqRLS.policies.length ? rfqRLS.policies : "0 policies ❌");

  console.log("\n=== 5) RLS & POLICIES FOR user_terms_acceptances ===");
  const utaRLS = await checkRLS("user_terms_acceptances");
  console.log("RLS enabled:", utaRLS.rlsEnabled);
  console.log("Policies:", utaRLS.policies.length ? utaRLS.policies : "0 policies ❌");

  console.log("\n=== 6) SUPPLIER ACCOUNTS FOR ALL TEST USERS ===");
  const users = await run(`
    SELECT u.id, u.email, ur.role,
           s.id as supplier_id, s.company_name, s.status as supplier_status, s.is_verified
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    LEFT JOIN public.suppliers s ON s.user_id = u.id
    WHERE u.email IN ('admin@open-loopsa.com', 'staff@open-loopsa.com', 'user@open-loopsa.com')
    ORDER BY u.email
  `);
  for (const u of users.rows) {
    console.log(JSON.stringify(u));
  }

  console.log("\n=== 7) CHECK IF ANY APPROVED SUPPLIER EXISTS (who can submit quotes) ===");
  const approvedSup = await run(`
    SELECT COUNT(*) as count FROM public.suppliers WHERE status = 'approved'
  `);
  console.log("Approved suppliers count:", approvedSup.rows[0]?.count);

  console.log("\n=== 8) PUBLISHED RFQs AVAILABLE (to know if there's anything to quote on) ===");
  const available = await run(`
    SELECT id, title, is_open, status FROM public.rfqs WHERE status = 'published'
  `);
  console.log("Available:", available.rows.length);
  for (const r of available.rows) console.log("  -", r.id, r.title);

  console.log("\n=== 9) TEST: TRY INSERT AS AUTHENTICATED SUPPLIER ROLE ===");
  // Find any user who has a supplier account
  const testUser = await run(`
    SELECT u.id, u.email, s.id as sup_id FROM auth.users u
    JOIN public.suppliers s ON s.user_id = u.id
    LIMIT 1
  `);
  if (testUser.rows[0]) {
    const uid = testUser.rows[0].id;
    const testRfq = await run(`SELECT id FROM public.rfqs WHERE status='published' LIMIT 1`);
    if (testRfq.rows[0]) {
      const rfqId = testRfq.rows[0].id;
      // Now try as authenticated user
      const setCtx = await run(`
        SET ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub', $1, true) as sub;
      `, [uid]);
      console.log("Set context:", setCtx.ok ? "OK" : setCtx.error);

      const ins = await run(`
        INSERT INTO public.rfq_quotes (rfq_id, supplier_id, supplier_name, amount, contact)
        VALUES ($1, $2, 'DIAG TEST', '1000', 'diag@test.com')
        RETURNING id
      `, [rfqId, uid]);
      console.log("Insert rfq_quotes:", ins.ok ? "✅ SUCCESS id:" + ins.rows[0].id : "❌ FAIL: " + (ins.error || "") + (ins.detail ? " | DETAIL: " + ins.detail : ""));

      const ins2 = await run(`
        INSERT INTO public.user_terms_acceptances (user_id, terms_version, acceptance_type, related_action)
        VALUES ($1, 'v1.0', 'quote', 'quote.submitted')
        RETURNING id
      `, [uid]);
      console.log("Insert user_terms_acceptances:", ins2.ok ? "✅ SUCCESS id:" + ins2.rows[0].id : "❌ FAIL: " + (ins2.error || "") + (ins2.detail ? " | DETAIL: " + ins2.detail : ""));

      await run("RESET ROLE");
    } else console.log("No published RFQ available for test");
  } else console.log("No supplier user found for test");

  await client.end();
  console.log("\nDone");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
