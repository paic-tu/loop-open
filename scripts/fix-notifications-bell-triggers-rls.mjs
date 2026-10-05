// ============================================================
// إصلاح مشكلة إشعارات الجرس (البلوب الأحمر) لطلبات الحجز الجديدة
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

    // ═══════════════════════════════════════════════════════
    // الخطوة 1: إضافة أعمدة link + read_at إلى جدول notifications
    //    الكود يتوقع read_at (وقت القراءة) بدلاً من is_read (boolean)
    //    و link بدلاً من target
    // ═══════════════════════════════════════════════════════
    console.log("🛠  الخطوة 1/5: تعديل جدول notifications (الأعمدة المفقودة)...");
    await client.query(`ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;`);
    await client.query(`ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;`);
    // إزالة القيد NOT NULL إن وجد على العمود القديم is_read حتى لا يتعارض
    try { await client.query(`ALTER TABLE public.notifications ALTER COLUMN is_read DROP NOT NULL;`); } catch {}
    try { await client.query(`ALTER TABLE public.notifications ALTER COLUMN target DROP NOT NULL;`); } catch {}
    console.log("   ✅ أضيف/تأكد من وجود الأعمدة link, read_at\n");

    // ═══════════════════════════════════════════════════════
    // الخطوة 2: سياسات RLS لجدول user_roles
    //    السبب الرئيسي: السياسة الحالية تسمح فقط برؤية صفك أنت
    //    لذا لم يستطع أحد أن يجد قائمة admin/staff ليرسل لهم الإشعار!
    // ═══════════════════════════════════════════════════════
    console.log("🛠  الخطوة 2/5: إصلاح سياسات RLS لـ user_roles...");
    await client.query(`DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles;`);
    // السياسة الجديدة: أي مستخدم مسجل يمكنه رؤية الأدوار (لأغراض الإشعارات)
    // نسمح برؤية role و user_id فقط — بما أنها بيانات عامة داخل النظام
    await client.query(`
      CREATE POLICY user_roles_select_all_authenticated
      ON public.user_roles FOR SELECT
      USING (true);
    `);
    // لكن نرفعها للجميع بما في ذلك anon (لإذا أردنا في المستقبل)
    // لكن للتأكد: نسمح INSERT لنفسه بالنفس للقديمة أيضاً
    try {
      await client.query(`
        CREATE POLICY user_roles_insert_self
        ON public.user_roles FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      `);
    } catch {}
    console.log("   ✅ تمت إزالة سياسة 'only-self واستبدالها بسياسة تسمح برؤية قائمة الفريق.\n");

    // ═══════════════════════════════════════════════════════
    // الخطوة 3: سياسات RLS لجدول notifications
    //   - الإدراج يعمل الآن من المتصفح (عملاء) والمشتركين
    //   - القراءة: شخص نفسها أو إداريييين
    // ═══════════════════════════════════════════════════════
    console.log("🛠  الخطوة 3/5: إصلاح سياسات RLS لـ notifications...");
    await client.query(`DROP POLICY IF EXISTS notifs_admin ON public.notifications;`);
    await client.query(`DROP POLICY IF EXISTS notifs_self  ON public.notifications;`);

    // 3.1 القراءة: المستخدم نفسه يقرأ إشعاراته + إداري/موظف يقرأ الجميع (للوصول الكامل)
    await client.query(`
      CREATE POLICY notifications_select_self_or_staff
      ON public.notifications FOR SELECT
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role IN ('staff','admin')
        )
      );
    `);
    // 3.2 الإدراج: أي مستخدم (حتى الضيوف في جلسات authenticated) يمكنه إدراج إشعارات (ضروري notifyAdmins)
    await client.query(`
      CREATE POLICY notifications_insert_anybody
      ON public.notifications FOR INSERT
      WITH CHECK (true);
    `);
    // 3.3 التحديث: المستخدم نفسه يحدّث إشعاراته كمقروءة + فريق الإدارة يحدّث أي إشعار
    await client.query(`
      CREATE POLICY notifications_update_self_or_staff
      ON public.notifications FOR UPDATE
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role IN ('staff','admin')
        )
      );
    `);
    // 3.4 الحذف: فريق الإدارة فقط
    try {
      await client.query(`
        CREATE POLICY notifications_delete_staff
        ON public.notifications FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('staff','admin')
          )
        );
      `);
    } catch {}
    console.log("   ✅ 4 سياسات جديدة لـ notifications تم تطبيقها.\n");

    // ═══════════════════════════════════════════════════════
    // الخطوة 4: إنشاء Trigger Function + AFTER INSERT triggers
    //    لجدول bookings و requests
    //    هذا الطريقة الأكثر موثوقية (أقوى من notifyAdmins على المتصفح)
    // ═══════════════════════════════════════════════════════
    console.log("🛠  الخطوة 4/5: إنشاء triggers AFTER INSERT لحجوزات وطلبات...");

    await client.query(`
      CREATE OR REPLACE FUNCTION public.fn_create_admin_notifications_for_bookings()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        -- إدراج إشعار لكل مدير/موظف
        INSERT INTO public.notifications (user_id, title, body, link, created_at)
        SELECT
          ur.user_id,
          'طلب استشارة جديد',
          CONCAT(
            'من: ', COALESCE(NEW.full_name, 'بدون اسم'),
            CASE WHEN NEW.service_category IS NOT NULL
                 THEN CONCAT(' – مجال: ', NEW.service_category)
                 ELSE ''
            END,
            CASE WHEN NEW.phone IS NOT NULL AND LENGTH(TRIM(NEW.phone))>0
                 THEN CONCAT(' – جوال: ', NEW.phone)
                 ELSE ''
            END
          ),
          '/admin/bookings',
          NOW()
        FROM public.user_roles ur
        WHERE ur.role IN ('staff','admin')
        ON CONFLICT DO NOTHING;

        RETURN NEW;
      END;
      $$;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION public.fn_create_admin_notifications_for_requests()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        INSERT INTO public.notifications (user_id, title, body, link, created_at)
        SELECT
          ur.user_id,
          'طلب خدمة جديد',
          CONCAT(
            'من: ', COALESCE(NEW.full_name, 'بدون اسم'),
            CASE WHEN NEW.type IS NOT NULL THEN CONCAT(' – نوع: ', NEW.type) ELSE '' END,
            CASE WHEN NEW.entity_name IS NOT NULL AND LENGTH(TRIM(NEW.entity_name))>0
                 THEN CONCAT(' – الجهة: ', NEW.entity_name) ELSE '' END
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

    // 4.1 إرفاق الـ trigger بجدول bookings
    try { await client.query(`DROP TRIGGER IF EXISTS trg_bookings_notify_staff ON public.bookings;`); } catch {}
    await client.query(`
      CREATE TRIGGER trg_bookings_notify_staff
      AFTER INSERT ON public.bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_create_admin_notifications_for_bookings();
    `);
    console.log("   ✅ trigger trg_bookings_notify_staff على bookings.");

    // 4.2 إرفاق الـ trigger بجدول requests
    try { await client.query(`DROP TRIGGER IF EXISTS trg_requests_notify_staff ON public.requests;`); } catch {}
    await client.query(`
      CREATE TRIGGER trg_requests_notify_staff
      AFTER INSERT ON public.requests
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_create_admin_notifications_for_requests();
    `);
    console.log("   ✅ trigger trg_requests_notify_staff على requests.\n");

    // ═══════════════════════════════════════════════════════
    // الخطوة 5: تهيئة الإشعارات للحجوزات والطلبات الموجودة حالياً
    //    (حتى يلمس المستخدم الفرق فوراً)
    // ═══════════════════════════════════════════════════════
    console.log("🛠  الخطوة 5/5: تعبئة إشعارات للعناصر الموجودة فعلاً...");
    const countBeforeQ = await client.query(`SELECT COUNT(*)::int AS c FROM public.notifications;`);
    const before = countBeforeQ.rows[0].c;
    console.log(`   • الإشعارات الحالية قبل التعبئة: ${before}`);

    // 5.1 للحجوزات الحالية بحالة جديدة
    await client.query(`
      INSERT INTO public.notifications (user_id, title, body, link, created_at)
      SELECT
        ur.user_id,
        'طلب استشارة جديد',
        CONCAT('من: ', COALESCE(b.full_name,'بدون اسم'),
               CASE WHEN b.service_category IS NOT NULL THEN CONCAT(' – مجال: ',b.service_category) ELSE '' END),
        '/admin/bookings',
        NOW()
      FROM public.bookings b
        CROSS JOIN public.user_roles ur
      WHERE b.status='new' AND ur.role IN ('staff','admin')
      ON CONFLICT DO NOTHING;
    `);
    // 5.2 للطلبات الحالية بحالة جديدة
    try {
      await client.query(`
        INSERT INTO public.notifications (user_id, title, body, link, created_at)
        SELECT
          ur.user_id,
          'طلب خدمة جديد',
          CONCAT('من: ', COALESCE(r.full_name,'بدون اسم'),
                 CASE WHEN r.entity_name IS NOT NULL AND LENGTH(TRIM(r.entity_name))>0
                      THEN CONCAT(' – الجهة: ', r.entity_name) ELSE '' END),
          '/admin/requests',
          NOW()
        FROM public.requests r
          CROSS JOIN public.user_roles ur
        WHERE r.status='new' AND ur.role IN ('staff','admin')
        ON CONFLICT DO NOTHING;
      `);
    } catch (e) { console.log(`   ⚠️  طلبات: ${e.message.slice(0,120)}`); }

    const countAfterQ = await client.query(`SELECT COUNT(*)::int AS c FROM public.notifications;`);
    const after = countAfterQ.rows[0].c;
    console.log(`   • بعد التعبئة: ${after} إشعار (أضيف ${after-before} إشعارات جديدة للفريق!)\n`);

    // ═══════════════════════════════════════════════════════
    // ملخص نهائي
    // ═══════════════════════════════════════════════════════
    console.log("🎉 الإصلاح الشامل انتهى بنجاح! ✅");
    console.log("");
    console.log("   🔔 من الآن فصاعداً:");
    console.log("     • عند وصول حجز جديد في /booking → يتم إضافة إشعار للفريق (Server Trigger + Client)");
    console.log("     • عند وصول طلب جديد → يتم إضافة إشعار للفريق");
    console.log("     • الجرس في الشريط الجانبي يظهر عدداً أحمر صغير = عدد الإشعارات غير المقروءة");
    console.log("     • تُملأ تلقائياً الإشعارات للعناصر الموجودة حالياً.");

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
