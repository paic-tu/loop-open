import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password: process.argv[2] || "9A182SlQ0Zfo1yRX",
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();
const { rows } = await client.query(
  `SELECT id, title, status, internal_notes, updated_at
   FROM public.requests
   WHERE id::text LIKE '5a293a94%'
   ORDER BY created_at DESC
   LIMIT 1`
);

if (rows.length > 0) {
  const r = rows[0];
  console.log("=".repeat(65));
  console.log("✅ الطلب #" + r.id.slice(0, 10) + "…");
  console.log("   العنوان   : " + r.title);
  console.log("   الحالة    : " + r.status);
  console.log("   آخر تعديل : " + new Date(r.updated_at).toLocaleString("ar-SA"));
  console.log("=".repeat(65));
  console.log("");
  console.log("📝 الملاحظات الداخلية:");
  console.log("-".repeat(65));
  if (r.internal_notes) {
    console.log(r.internal_notes);
  } else {
    console.log("❌ لا توجد ملاحظات (فارغة).");
  }
  console.log("-".repeat(65));
} else {
  console.log("❌ لا يوجد طلب بهذا المعرف.");
}

client.release();
await pool.end();
