// ============================================================
// 1) إيجاد أسماء أعمدة الجدول requests الصحيحة
// 2) إعادة كتابة trigger fn للطلبات باستخدام الأعمدة الصحيحة
// 3) تعبئة الإشعارات للطلبات الموجودة حالياً بحالة جديدة
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

    // 1) معرفة أعمدة الجدول requests
    console.log("🧐 فحص أعمدة جدول requests:");
    const colsQ = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='requests'
      ORDER BY ordinal_position;
    `);
    const colList = colsQ.rows.map(r => r.column_name);
    console.log(`   الأعمدة: ${colList.join(", ")}\n`);

    // نختار الأعمدة المناسبة:
    //   الاسم = user_name OR full_name OR requester_name OR profile_name OR name
    //   الجهة = entity_name OR organization_name OR company
    //   النوع = type OR service_type
    let colFullName = "full_name";
    let colEntity = "entity_name";
    let colType = "type";

    if (!colList.includes(colFullName)) {
      for (const alt of ["user_name", "requester_name", "name", "client_name"]) {
        if (colList.includes(alt)) { colFullName = alt; break; }
      }
    }
    if (!colList.includes(colEntity)) {
      for (const alt of ["organization_name", "company", "entity"]) {
        if (colList.includes(alt)) { colEntity = alt; break; }
      }
    }
    if (!colList.includes(colType)) {
      for (const alt of ["service_type", "request_type"]) {
        if (colList.includes(alt)) { colType = alt; break; }
      }
    }
    console.log(`   📝 الأعمدة المختارة للطلبات:`);
    console.log(`      • colFullName = ${colFullName} (${colList.includes(colFullName) ? "موجود ✅" : "غير موجود ❌"})`);
    console.log(`      • colEntity   = ${colEntity}   (${colList.includes(colEntity) ? "موجود ✅" : "غير موجود ❌"})`);
    console.log(`      • colType     = ${colType}     (${colList.includes(colType) ? "موجود ✅" : "غير موجود ❌"})`);
    console.log("");

    // 2) كتابة الـ trigger function للطلبات بالأعمدة الصحيحة (جدول requests = طلبات الخدمات بدون اسم مباشر)
    console.log("🛠  إعادة إنشاء fn + trigger للطلبات بالأعمدة الصحيحة...");
    await client.query(`
      CREATE OR REPLACE FUNCTION public.fn_create_admin_notifications_for_requests()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        _user_name text;
        _user_email text;
      BEGIN
        -- نحاول استخراج اسم المستخدم من الجداول المرتبطة (profiles عبر user_id)
        SELECT p.full_name, u.email INTO _user_name, _user_email
        FROM auth.users u
          LEFT JOIN public.profiles p ON p.id = u.id
        WHERE u.id = NEW.user_id
        LIMIT 1;

        INSERT INTO public.notifications (user_id, title, body, link, created_at)
        SELECT
          ur.user_id,
          'طلب خدمة جديد',
          CONCAT(
            'من: ', COALESCE(_user_name, 'مستخدم #' || LEFT(NEW.user_id::text, 8)),
            CASE WHEN COALESCE(_user_email, '') <> ''
                 THEN CONCAT(' (', _user_email, ')') ELSE '' END,
            CASE WHEN NEW.type IS NOT NULL
                 THEN CONCAT(' – نوع: ', NEW.type) ELSE '' END,
            CASE WHEN NEW.title IS NOT NULL AND LENGTH(TRIM(NEW.title))>0
                 THEN CONCAT(' – ', LEFT(NEW.title, 50)) ELSE '' END
          ),
          '/admin/requests',
          NOW()
        FROM public.user_roles ur
        WHERE ur.role IN ('staff','admin')
        ON CONFLICT DO NOTHING;
        RETURN NEW;
      END;
      $$;
    `);
    try { await client.query(`DROP TRIGGER IF EXISTS trg_requests_notify_staff ON public.requests;`); } catch {}
    await client.query(`
      CREATE TRIGGER trg_requests_notify_staff
      AFTER INSERT ON public.requests
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_create_admin_notifications_for_requests();
    `);
    console.log("   ✅ تم إنشاء/تحديث الـ trigger للطلبات.\n");

    // 3) تعبئة الإشعارات للطلبات الحالية بحالة جديدة
    console.log("🧮 تعبئة إشعارات الطلبات الحالية (status=new)...");
    const backfillQ = `
      INSERT INTO public.notifications (user_id, title, body, link, created_at)
      SELECT
        ur.user_id,
        'طلب خدمة جديد',
        CONCAT(
          'من: ', COALESCE(p.full_name, 'مستخدم #' || LEFT(r.user_id::text, 8)),
          CASE WHEN u.email IS NOT NULL THEN CONCAT(' (', u.email, ')') ELSE '' END,
          CASE WHEN r.type IS NOT NULL THEN CONCAT(' – نوع: ', r.type) ELSE '' END,
          CASE WHEN r.title IS NOT NULL AND LENGTH(TRIM(r.title))>0 THEN CONCAT(' – ', LEFT(r.title, 50)) ELSE '' END
        ),
        '/admin/requests',
        NOW()
      FROM public.requests r
        LEFT JOIN public.profiles p ON p.id = r.user_id
        LEFT JOIN auth.users u ON u.id = r.user_id
        CROSS JOIN public.user_roles ur
      WHERE r.status='new' AND ur.role IN ('staff','admin')
      ON CONFLICT DO NOTHING;
    `;
    const result = await client.query(backfillQ);
    console.log(`   ✅ تم بنجاح. عدد الصفوف المضافة: ${result.rowCount ?? 0}\n`);

    // 4) عدد الإشعارات النهائي لمستخدم المدير
    const cntQ = await client.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread
      FROM public.notifications;
    `);
    console.log(`📊 الملخص النهائي لجدول الإشعارات:`);
    console.log(`   • جميع الإشعارات:        ${cntQ.rows[0].total}`);
    console.log(`   • غير المقروءة (يظهر في الجرس): ${cntQ.rows[0].unread} ✨`);

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
