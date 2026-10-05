// ============================================================
// مقارنة: أعمدة library_files الموجودة في DB vs ما يستخدمه الكود
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

    const { rows } = await client.query(`
      SELECT
        c.column_name, c.data_type, c.is_nullable, c.column_default
      FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name='library_files'
      ORDER BY c.ordinal_position;
    `);
    console.log("📋 أعمدة library_files الحالية في قاعدة البيانات:");
    console.log("   ─────────────────────────────────────────────");
    const dbCols = new Set();
    for (const r of rows) {
      const nullable = r.is_nullable === "YES" ? "NULLABLE" : "NOT NULL";
      const def = r.column_default ? `  DEFAULT: ${String(r.column_default).slice(0, 45)}` : "";
      console.log(`   • ${r.column_name.padEnd(22)} ${String(r.data_type).padEnd(18)} ${nullable}${def}`);
      dbCols.add(r.column_name);
    }
    console.log("\n─────────────────────────────────────────────");
    console.log("🔍 الأعمدة التي يتوقعها الكود في library.ts:");
    const expected = [
      // LibraryFile type + payload keys in createOrUpdateLibraryFile
      "id", "title", "description", "category", "file_path", "file_name",
      "file_size", "mime_type", "download_count", "is_published",
      "sort_order", "icon_name", "created_at", "updated_at", "created_by",
    ];
    const missing = [];
    for (const c of expected) {
      const found = dbCols.has(c);
      console.log(`   ${found ? "✅" : "❌"} ${c}`);
      if (!found) missing.push(c);
    }
    console.log("\n");
    if (missing.length === 0) {
      console.log("🎉 جميع الأعمدة المتوقعة موجودة!");
    } else {
      console.log(`⚠️  ${missing.length} أعمدة مفقودة في الجدول: ${missing.join(", ")}`);
    }

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
