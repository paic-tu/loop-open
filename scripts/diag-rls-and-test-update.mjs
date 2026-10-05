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

function log(title, obj) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

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
  console.log("Connected to DB");

  // 1) Check RLS enabled and policies for the 3 tables
  const tables = ["community_entities", "suppliers", "rfqs"];
  for (const t of tables) {
    const rls = await run(`
      SELECT relrowsecurity as rls_enabled, relforcerowsecurity as force_rls
      FROM pg_class WHERE relname = $1
    `, [t]);
    log(`RLS status for ${t}`, rls.rows);

    const policies = await run(`
      SELECT polname, polcmd, polroles, polqual, polwithcheck
      FROM pg_policy
      JOIN pg_class ON pg_policy.polrelid = pg_class.oid
      WHERE pg_class.relname = $1
      ORDER BY polcmd
    `, [t]);
    log(`Policies for ${t} (${policies.rows.length})`, policies.rows);
  }

  // 2) Check user_roles for admin
  const roles = await run(`
    SELECT u.email, ur.role, ur.user_id
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE u.email = 'admin@open-loopsa.com'
  `);
  log("Admin role info", roles.rows);
  const adminId = roles.rows[0]?.user_id;

  if (adminId) {
    // 3) Test direct UPDATE as postgres superuser (bypass RLS) on CE
    const pendingCE = await run(`
      SELECT id, entity_name, status FROM public.community_entities
      WHERE status = 'pending' LIMIT 1
    `);
    log("Pending CE target", pendingCE.rows);

    if (pendingCE.rows[0]) {
      const ceId = pendingCE.rows[0].id;
      const now = new Date().toISOString();
      const testUpdate = await run(`
        UPDATE public.community_entities
        SET status = 'approved',
            is_verified = true,
            verified_at = $1::timestamptz,
            document_status = 'verified',
            document_status_updated_at = $2::timestamptz,
            updated_at = $3::timestamptz
        WHERE id = $4
      `, [now, now, now, ceId]);
      log(`Direct UPDATE CE ${ceId} as postgres`, testUpdate);

      // Check the result
      const verifyCE = await run(
        `SELECT id, status, is_verified, verified_at, document_status, document_status_updated_at FROM public.community_entities WHERE id = $1`,
        [ceId]
      );
      log("Verify CE after direct update", verifyCE.rows);
    }

    // 4) Also try via SET ROLE to authenticated + SET request.jwt to simulate Supabase
    const pendingCE2 = await run(`
      SELECT id, entity_name, status FROM public.community_entities
      WHERE status = 'pending' LIMIT 1
    `);
    if (pendingCE2.rows[0]) {
      const ceId2 = pendingCE2.rows[0].id;
      const now = new Date().toISOString();
      console.log("\n=== Testing RLS-aware UPDATE as admin user ===");
      // Set the session to simulate admin
      const setCtx = await run(`
        SET ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub', $1, true);
      `, [adminId]);
      console.log("set ctx:", setCtx);

      const rlsUpdate = await run(`
        UPDATE public.community_entities
        SET status = 'approved',
            is_verified = true,
            verified_at = $1::timestamptz,
            document_status = 'verified',
            document_status_updated_at = $2::timestamptz,
            updated_at = $3::timestamptz
        WHERE id = $4
      `, [now, now, now, ceId2]);
      log(`RLS UPDATE CE ${ceId2}`, rlsUpdate);

      // Reset role
      await run("RESET ROLE");
    }
  }

  // 5) Check all existing approvals rows
  const approvals = await run(`
    SELECT id, entity_type, entity_id::text, status, reviewer_id::text, reviewed_at
    FROM public.approvals
    ORDER BY created_at DESC LIMIT 10
  `);
  log("Approvals last 10 rows", approvals.rows);

  // 6) Count of pending status per table
  for (const t of tables) {
    const cnt = await run(`
      SELECT status, COUNT(*) as c
      FROM public.${t}
      GROUP BY status
      ORDER BY status
    `);
    log(`${t} status counts`, cnt.rows);
  }

  await client.end();
  console.log("\nDone");
}

main().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
