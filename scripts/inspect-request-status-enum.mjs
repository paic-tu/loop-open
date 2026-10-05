// ============================================================
// فحص قيم enum request_status_enum الفعلية في قاعدة البيانات
// + فحص بيانات عمود status في جدول requests
// ============================================================
import pg from "pg";
const { Pool } = pg;

const DB_PASSWORD = process.argv[2] || "9A182SlQ0Zfo1yRX";

const pool = new Pool({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password: DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("✅ متصل بقاعدة البيانات\n");

    // 1) هل عمود status في requests نوعه Enum فعلاً ولا text؟
    console.log("🛠  1) فحص نوع عمود status في جدول requests:");
    const { rows: colInfo } = await client.query(`
      SELECT
        c.column_name,
        c.data_type,
        c.column_default,
        c.is_nullable,
        c.udt_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type
      FROM information_schema.columns c
      JOIN pg_attribute a ON a.attname = c.column_name
      JOIN pg_class cl ON cl.oid = a.attrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE c.table_schema = 'public'
        AND c.table_name = 'requests'
        AND c.column_name = 'status'
        AND ns.nspname = 'public'
        AND cl.relname = 'requests';
    `);
    for (const r of colInfo) {
      console.log(`   • column_name: ${r.column_name}`);
      console.log(`   • data_type: ${r.data_type}`);
      console.log(`   • udt_name: ${r.udt_name}`);
      console.log(`   • full_type: ${r.full_type}`);
      console.log(`   • default: ${r.column_default}`);
      console.log(`   • is_nullable: ${r.is_nullable}`);
    }
    console.log();

    // 2) قيم Enum request_status_enum إن وجدت
    console.log("🛠  2) قيم request_status_enum (إن كان Enum موجوداً):");
    const { rows: enumVals } = await client.query(`
      SELECT t.typname AS enum_name,
             e.enumlabel AS enum_value,
             e.enumsortorder AS sort_order
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public' AND t.typname ILIKE '%request%status%'
      ORDER BY e.enumsortorder;
    `);
    if (enumVals.length === 0) {
      console.log("   ❌ لا يوجد أي Enum يطابق request_status_enum!");
    } else {
      for (const v of enumVals) {
        console.log(`   [${v.sort_order}] ${v.enum_name} = "${v.enum_value}"`);
      }
    }
    console.log();

    // 3) أي Enums موجودة في public schema؟
    console.log("🛠  3) جميع الأنواع المخصصة في public schema:");
    const { rows: allTypes } = await client.query(`
      SELECT t.typname, t.typtype
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public' AND t.typtype = 'e'
      ORDER BY t.typname;
    `);
    if (allTypes.length === 0) {
      console.log("   لا توجد أنواع enum مخصصة في schema public.");
    } else {
      for (const t of allTypes) console.log(`   • ${t.typname} (typtype=${t.typtype})`);
    }
    console.log();

    // 4) قيم status الفعلية الموجودة حالياً في جدول requests
    console.log("🛠  4) توزيع قيم status الحالية في جدول requests:");
    const { rows: statusDist } = await client.query(`
      SELECT status, COUNT(*)::int AS n FROM public.requests GROUP BY status ORDER BY n DESC;
    `);
    for (const r of statusDist) console.log(`   • "${r.status}" → ${r.n} طلب`);

    process.exit(0);
  } catch (e) {
    console.error("❌ DB ERROR:", e.message || e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
