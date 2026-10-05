// ============================================================
// Verify Community RFQ - inspect columns first
// ============================================================
import pg from "pg";
const { Client } = pg;

const DB_PASSWORD = process.argv[2] || "9A182SlQ0Zfo1yRX";

const client = new Client({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password: DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("✅ Connected to Supabase DB directly\n");

  // 1) Inspect rfqs columns
  console.log("========== 1) أعمدة جدول rfqs ==========");
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rfqs'
    ORDER BY ordinal_position
  `);
  console.table(cols.rows);

  // 2) Select * from rfqs latest 3
  console.log("\n========== 2) أحدث 3 صفوف في rfqs ==========");
  const rfqs = await client.query(`SELECT * FROM public.rfqs ORDER BY created_at DESC LIMIT 3`);
  console.table(rfqs.rows);

  // 3) user_terms_acceptances latest 3
  console.log("\n========== 3) أحدث 3 موافقات شروط ==========");
  const utaCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='user_terms_acceptances' ORDER BY ordinal_position`);
  const uta = await client.query(`SELECT * FROM public.user_terms_acceptances ORDER BY accepted_at DESC NULLS LAST LIMIT 3`);
  console.table(uta.rows);

  // 4) audit_logs latest 5
  console.log("\n========== 4) أحدث 5 سجلات تدقيق ==========");
  const audits = await client.query(`SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 5`);
  console.table(audits.rows);

  // 5) Counts
  console.log("\n========== 5) ملخص الإجماليات ==========");
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.community_entities) AS community_entities,
      (SELECT COUNT(*) FROM public.rfqs) AS rfqs,
      (SELECT COUNT(*) FROM public.suppliers) AS suppliers,
      (SELECT COUNT(*) FROM public.user_terms_acceptances) AS uta,
      (SELECT COUNT(*) FROM public.audit_logs) AS audit_logs
  `);
  const c = counts.rows[0];
  console.log(`جهات مجتمعية: ${c.community_entities} | فرص RFQ: ${c.rfqs} | موردون: ${c.suppliers} | موافقات: ${c.uta} | تدقيق: ${c.audit_logs}`);

  process.exit(0);
} catch (e) {
  console.error("❌ Fatal:", e.message);
  process.exit(1);
}
