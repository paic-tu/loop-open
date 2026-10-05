// ============================================================
// إنشاء جدول request_notes للملاحظات الداخلية المتراكمة + RLS + Migrate الملاحظات القديمة
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

    // 1) إنشاء الجدول إن لم يكن موجوداً
    console.log("🛠  1) إنشاء جدول request_notes...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.request_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
        author_name text,
        content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 5000),
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_request_notes_request_id ON public.request_notes(request_id);
      CREATE INDEX IF NOT EXISTS idx_request_notes_created_at ON public.request_notes(created_at DESC);
    `);
    console.log("   ✅ جدول request_notes جاهز (مُفهرس حسب request_id + created_at)");

    // 2) تفعيل RLS وإنشاء 4 سياسات متوافقة مع نمط Admin/Staff
    console.log("\n🛠  2) تفعيل RLS + السياسات على request_notes...");
    await client.query(`ALTER TABLE public.request_notes ENABLE ROW LEVEL SECURITY`);

    // إسقاط سياسات قديمة إن وجدت
    const dropOld = `
      DROP POLICY IF EXISTS request_notes_select_staff ON public.request_notes;
      DROP POLICY IF EXISTS request_notes_insert_staff ON public.request_notes;
      DROP POLICY IF EXISTS request_notes_update_author ON public.request_notes;
      DROP POLICY IF EXISTS request_notes_delete_admin ON public.request_notes;
    `;
    await client.query(dropOld);

    await client.query(`
      -- SELECT: staff/admin يرون كل الملاحظات على طلب ما
      CREATE POLICY request_notes_select_staff ON public.request_notes FOR SELECT TO public USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND (ur.role::text = 'staff' OR ur.role::text = 'admin')
        )
      );

      -- INSERT: staff/admin فقط بإضافة ملاحظات، مع فرض author_id = auth.uid()
      CREATE POLICY request_notes_insert_staff ON public.request_notes FOR INSERT TO public WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND (ur.role::text = 'staff' OR ur.role::text = 'admin')
        )
        AND author_id = auth.uid()
      );

      -- UPDATE: صاحب الملاحظة فقط أو Admin
      CREATE POLICY request_notes_update_author ON public.request_notes FOR UPDATE TO public
      USING (
        author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin'
        )
      )
      WITH CHECK (
        author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin'
        )
      );

      -- DELETE: Admin فقط يقدر يحذف أي ملاحظة، Author يحذف ملاحظاته
      CREATE POLICY request_notes_delete_admin ON public.request_notes FOR DELETE TO public USING (
        author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin'
        )
      );

      -- منح الصلاحيات على الجدول
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_notes TO authenticated;
    `);
    console.log("   ✅ 4 سياسات RLS مفعلة (SELECT/INSERT/UPDATE/DELETE)");

    // 3) ترحيل الملاحظات القديمة من internal_notes إلى أول تعليق
    console.log("\n🛠  3) ترحيل الملاحظات القديمة من requests.internal_notes...");
    const { rowCount: migrated } = await client.query(`
      INSERT INTO public.request_notes (request_id, author_id, author_name, content, created_at)
      SELECT
        r.id AS request_id,
        COALESCE(r.user_id, NULL) AS author_id,
        'ترحيل من الملاحظة القديمة' AS author_name,
        r.internal_notes AS content,
        COALESCE(r.updated_at, r.created_at) AS created_at
      FROM public.requests r
      WHERE r.internal_notes IS NOT NULL AND char_length(trim(both ' \t\n\r' from r.internal_notes)) > 0
      -- تجنب التكرار لو ركضنا السكربت ثانية
      AND NOT EXISTS (
        SELECT 1 FROM public.request_notes rn
        WHERE rn.request_id = r.id AND rn.author_name = 'ترحيل من الملاحظة القديمة'
      );
    `);
    console.log(`   ✅ تم ترحيل ${migrated} ملاحظة قديمة إلى جدول request_notes كـ "أول تعليق"`);

    // 4) طباعة عينة
    console.log("\n🗂  4) عينة من الجدول:");
    const sample = await client.query(`
      SELECT rn.id, rn.request_id, rn.author_name, left(rn.content, 80) as content, rn.created_at
      FROM public.request_notes rn
      ORDER BY rn.created_at DESC
      LIMIT 5
    `);
    if (sample.rows.length === 0) {
      console.log("   (جدول فارغ حالياً، سوف يتم تعبئته عند كتابة الملاحظات الأولى)");
    } else {
      sample.rows.forEach((r, i) => {
        console.log(`   ${i + 1}) [${new Date(r.created_at).toLocaleString("ar-SA").slice(0, 16)}] ${r.author_name ?? "Unknown"} → ${r.content}${r.content.length >= 80 ? "…" : ""}`);
      });
    }

    console.log("\n✅ كل شيء جاهز! يمكنك الآن إضافة ملاحظات متراكمة فوق بعضها البعض.");
  } catch (e) {
    console.error("\n❌ خطأ:", e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void run();
