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

  // Get the regular user id to attribute RFQs to
  const user = await run(`
    SELECT id FROM auth.users WHERE email = 'user@open-loopsa.com' LIMIT 1
  `);
  const ownerId = user.rows[0]?.id || "4fb91ba0-70d0-4b3b-848a-388939ac054c"; // fallback to admin

  console.log("Using owner_id:", ownerId);

  const now = new Date().toISOString();
  const deadline = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  // 1) New RFQ pending #1
  const r1 = await run(`
    INSERT INTO public.rfqs (
      id, owner_id, title, entity_name, category, sector, region, city,
      description, status, requires_openloop_review, deadline,
      is_open, budget, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'تصميم هوية بصرية متكاملة لجمعية تنمية الأسرة',
      'جمعية تنمية الأسرة المخلصة',
      'خدمات تصميم وهوية',
      'التنمية الاجتماعية',
      'الرياض', 'الرياض',
      'تصميم شعار + كتيب الهوية + قوالب سوشيال ميديا + قوالب مطبوعة',
      'pending', true, $2,
      false, 35000, $3, $3
    ) RETURNING id, title, status
  `, [ownerId, deadline, now]);
  console.log("RFQ 1:", r1.rows, r1.error || "");

  // 2) New RFQ pending #2
  const r2 = await run(`
    INSERT INTO public.rfqs (
      id, owner_id, title, entity_name, category, sector, region, city,
      description, status, requires_openloop_review, deadline, deadline_date,
      is_open, budget, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'تسويق فعالية يوم المعلم الخيري 2026',
      'مؤسسة أمل التربوية',
      'خدمات تسويق وإعلان',
      'الفعاليات الخيرية',
      'جدة', 'جدة',
      'حملة تسويقية رقمية + إعلانات مدفوعة + تغطية سوشيال ميديا للفعالية',
      'pending', true, $2, $2,
      false, 28000, $3, $3
    ) RETURNING id, title, status
  `, [ownerId, deadline, now]);
  console.log("RFQ 2:", r2.rows, r2.error || "");

  // 3) New RFQ pending #3
  const r3 = await run(`
    INSERT INTO public.rfqs (
      id, owner_id, title, entity_name, category, sector, region, city,
      description, status, requires_openloop_review, deadline, deadline_date,
      is_open, budget, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'تصوير فيديو دعائي لمشروع إطعام الأسر المحتاجة',
      'جمعية خير بلا حدود',
      'خدمات إنتاج فيديو ومحتوى بصري',
      'الأطعمة والتغذية',
      'الدمام', 'الدمام',
      'فيديو دعائي دقيقتان + مقاطع قصيرة للتيك توك + صور فوتوغرافية للمشروع',
      'pending', true, $2, $2,
      false, 18500, $3, $3
    ) RETURNING id, title, status
  `, [ownerId, deadline, now]);
  console.log("RFQ 3:", r3.rows, r3.error || "");

  // Summary status counts
  console.log("\n=== FINAL STATUS COUNTS ===");
  for (const t of ["community_entities", "suppliers", "rfqs"]) {
    const cnt = await run(`
      SELECT status, COUNT(*) as c FROM public.${t} GROUP BY status ORDER BY status
    `);
    console.log(`${t}:`, cnt.rows);
  }

  await client.end();
  console.log("\nDone");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
