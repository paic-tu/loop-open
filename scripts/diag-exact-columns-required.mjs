// ============================================================
// تشخيص دقيق: الأعمدة الحقيقية الموجودة حالياً في الجداول الأساسية
// لمقارنتها مع ما يحاول الكود تمريره في update extra
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
  console.log("✅ Connected\n");

  // الأعمدة المطلوبة في كل جدول من الـ extra المرسل في buttons الاعتماد
  const requiredByTable = {
    community_entities: [
      // الكود يمرر في extra عند الاعتماد: verified_at, updated_at
      // وعند الرفض: is_verified, updated_at
      // والـ patch الأساسي: status, is_verified
      "status", "updated_at", "verified_at", "is_verified",
    ],
    suppliers: [
      // verified_at, updated_at عند الاعتماد، updated_at عند الرفض
      // patch أساسي: status
      "status", "updated_at", "verified_at",
    ],
    rfqs: [
      // approved_at, published_at, is_open, updated_at عند الاعتماد
      // rejected_at, is_open, rejection_reason, updated_at عند الرفض
      // patch أساسي: status
      "status", "approved_at", "published_at", "rejected_at",
      "rejection_reason", "is_open", "updated_at",
    ],
  };

  for (const [tbl, needed] of Object.entries(requiredByTable)) {
    console.log("=".repeat(70));
    console.log(`جدول ${tbl} — الأعمدة المطلوبة من الـ code vs الموجودة فعلياً:`);
    console.log("=".repeat(70));
    const actual = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [tbl]
    );
    const actualSet = new Set(actual.rows.map((c) => c.column_name));
    console.log(`\n   مجموع الأعمدة الحالية: ${actual.rows.length}\n`);
    // طباعة جميع الأعمدة الحالية
    console.table(actual.rows.map(c => ({
      col: c.column_name,
      type: c.data_type,
      null: c.is_nullable,
      default: (c.column_default || "").substring(0, 50),
    })));
    // مقارنة المطلوب
    console.log(`\n   التحقق من الأعمدة المستخدمة في buttons الاعتماد/الرفض (الـ extra):`);
    let missing = [];
    for (const col of needed) {
      if (actualSet.has(col)) console.log(`     ✅ ${col} موجود`);
      else {
        console.log(`     ❌ ${col} غير موجود — هذا يسبب خطأ UPDATE: column "${col}" of relation "${tbl}" does not exist`);
        missing.push(col);
      }
    }
    if (missing.length === 0) console.log(`   🎯 الجدول ${tbl} جاهز — جميع الأعمدة المطلوبة موجودة ✅`);
    else console.log(`   ⚠️  الجدول ${tbl} يفتقد: ${missing.join(", ")} ❌ — سبب مباشر لـ "تعذر تحديث الحالة" عند تحديث هذا النوع!`);
    console.log();
  }

  process.exit(0);
} catch (e) {
  console.error("Fatal:", e && e.message ? e.message : e);
  process.exit(1);
}
