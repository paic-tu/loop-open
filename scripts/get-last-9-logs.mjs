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

  console.log("=== Last 9 audit_logs (newest first) ===\n");
  const last9 = await run(`
    SELECT
      a.id, a.action, a.entity_type, a.entity_id,
      a.meta, a.created_at, a.actor_id,
      u.email, ur.role
    FROM public.audit_logs a
    LEFT JOIN auth.users u ON u.id = a.actor_id
    LEFT JOIN public.user_roles ur ON ur.user_id = a.actor_id
    ORDER BY a.created_at DESC
    LIMIT 9
  `);
  if (last9.ok && last9.rows && last9.rows.length) {
    for (let i = 0; i < last9.rows.length; i++) {
      const r = last9.rows[i];
      const t = r.created_at.toISOString().replace("T", " ").slice(0, 19);
      const who = r.email ? ((r.role || '—') + '/' + r.email.split('@')[0]) : 'system';
      const meta = r.meta ? JSON.stringify(r.meta) : '';
      console.log(String(i+1).padStart(2,' ') + " | " + t + " | " + who.padEnd(20) + " | " + r.action.padEnd(24) + " | " + r.entity_type.padEnd(12) + " | " + String(r.entity_id).slice(0,10).padEnd(10) + " | " + meta);
    }
  } else console.log("  (no rows) " + (last9.error || ""));

  console.log("\n=== Audit action counts ===");
  const counts = await run(`
    SELECT action, COUNT(*)::int as c
    FROM public.audit_logs
    GROUP BY action ORDER BY c DESC
  `);
  if (counts.ok && counts.rows) for (const r of counts.rows) console.log("  " + r.action.padEnd(24) + " × " + r.c);

  console.log("\n=== Last 9 notifications ===");
  const notif = await run(`
    SELECT id, user_id, link_text, read_at, created_at,
      CASE WHEN read_at IS NULL THEN 'unread' ELSE 'read' END as state
    FROM public.notifications ORDER BY created_at DESC LIMIT 9
  `);
  if (notif.ok && notif.rows) for (let i = 0; i < notif.rows.length; i++) {
    const r = notif.rows[i];
    const t = r.created_at.toISOString().replace("T"," ").slice(0,19);
    console.log(String(i+1).padStart(2,' ') + " | " + t + " | " + r.state.padEnd(6) + " | user=" + String(r.user_id).slice(0,8) + "… | " + ((r.link_text||'—').slice(0,70)));
  }

  console.log("\n=== Last 9 user_terms_acceptances ===");
  const uta = await run(`
    SELECT a.id, a.acceptance_type, a.related_action, a.related_id, a.terms_version, a.created_at, u.email
    FROM public.user_terms_acceptances a
    LEFT JOIN auth.users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 9
  `);
  if (uta.ok && uta.rows) for (let i = 0; i < uta.rows.length; i++) {
    const r = uta.rows[i];
    const t = r.created_at.toISOString().replace("T"," ").slice(0,19);
    console.log(String(i+1).padStart(2,' ') + " | " + t + " | " + r.acceptance_type.padEnd(8) + " | " + r.related_action.padEnd(18) + " | " + ((r.email||'').split('@')[0]).padEnd(12) + " | related=" + String(r.related_id).slice(0,10) + " | v=" + r.terms_version);
  }

  await client.end();
  console.log("\nDone ✅");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
