// ============================================================
// إنشاء المستخدمين التجريبيين الثلاثة (admin / staff / user)
// ============================================================
// ✅ طريقة التشغيل بعد التحديث (3 طرق — اختر أسهلها):
//
//   🅰️  [الطريقة الأسرع] أضف SERVICE_ROLE_KEY كـ CLI argument واحد فقط
//       node scripts/create-demo-users.mjs sb-service-XXXXXXXXX
//
//   🅱️  أضف السطر التالي إلى ملف .env ثم شغّل normally:
//       SUPABASE_SERVICE_ROLE_KEY=sb-service-XXXXXXXXX
//       node scripts/create-demo-users.mjs
//
//   🅲️  عدّل المتغيرات في بداية الملف (الطريقة القديمة)
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ------------------------------------------------------------
// ① نحاول تحميل ملف .env إذا كان موجوداً (لو كان مكتبة dotenv موثوقة نستخدمها
//   ولكن لتجنب إضافة dependency نستخدم parser بسيط built-in).
// ------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const envPath = join(projectRoot, ".env");

if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// ------------------------------------------------------------
// ② نجمع SUPABASE_URL + SERVICE_ROLE_KEY من كل المصادر المتاحة
//    مصادر الأولوية (من الأعلى للأدنى):
//      1. CLI argument (الموقع الأول بعد اسم الملف)
//      2. متغيرات البيئة (.env / system env)
//      3. القيم الثابتة أسفل هذا التعليق (للتعديل اليدوي)
// ------------------------------------------------------------
let SUPABASE_URL      = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL      || "";
let SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
                     || process.env.SERVICE_ROLE_KEY
                     || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
                     || "";

// نأخذ الـ service role كـ أول argument في الطرفية (الطريقة الأفضل والأسرع)
const cliServiceKey = process.argv[2];
if (cliServiceKey && !SERVICE_ROLE_KEY) {
  SERVICE_ROLE_KEY = cliServiceKey.trim();
}

// ③ نبنِ SUPABASE_URL تلقائياً من PROJECT_ID إن وجد (لأمان إضافي)
if (!SUPABASE_URL && (process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID)) {
  const pid = process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID;
  SUPABASE_URL = `https://${pid}.supabase.co`;
  process.stdout.write(`ℹ️  تم بناء SUPABASE_URL تلقائياً من PROJECT_ID: ${SUPABASE_URL}\n`);
}

// ------------------------------------------------------------
// ④ التحقق النهائي — إن كان هناك شيء ناقص نعطيه رسالة واضحة جداً
// ------------------------------------------------------------
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  process.stderr.write("\n❌ بيانات الاتصال بـ Supabase ناقصة!\n\n");

  if (!SUPABASE_URL) {
    process.stderr.write("   ⚠️  SUPABASE_URL غير موجود في البيئة أو ملف .env.\n");
  }
  if (!SERVICE_ROLE_KEY) {
    process.stderr.write(
      "   ⚠️  SERVICE_ROLE_KEY غير موجود. طريقة الحصول عليه:\n" +
      "   1. افتح: https://supabase.com/dashboard/project/" +
      (process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID || "YOUR_PROJECT") +
      "/settings/api\n" +
      "   2. في قسم Project API keys → انسخ key اسمه 👉 service_role (يبدأ بـ sb-service-...)\n" +
      "   3. ثم شغّل هكذا (كلو في سطر واحد):\n\n" +
      '      node scripts/create-demo-users.mjs "sb-service-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"\n\n' +
      "      أو (طريقة ثانية) أضف هذا السطر إلى نهاية ملف .env:\n" +
      "      SUPABASE_SERVICE_ROLE_KEY=sb-service-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\n\n"
    );
  }
  process.exit(1);
}

// ============================================================
// ⑤ الاتصال بالـ Admin API (بدون تخزين أي جلسة)
// ============================================================
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = [
  {
    email:    "admin@open-loopsa.com",
    password: "Admin@OpenLoop2026",
    role:     "admin",
    profile:  {
      full_name: "مدير المنصة العام",
      phone:     "+966500000001",
      company:   "Open Loop HQ",
      city:      "الرياض",
    },
    label:    "① المدير العام",
  },
  {
    email:    "staff@open-loopsa.com",
    password: "Staff@OpenLoop2026",
    role:     "staff",
    profile:  {
      full_name: "موظف الدعم الفني",
      phone:     "+966500000002",
      company:   "Open Loop Support",
      city:      "جدة",
    },
    label:    "② موظف الدعم",
  },
  {
    email:    "user@open-loopsa.com",
    password: "User@OpenLoop2026",
    role:     "user",
    profile:  {
      full_name: "عميل تجريبي",
      phone:     "+966500000003",
      company:   "شركة العميل التجريبية",
      city:      "الدمام",
    },
    label:    "③ العميل العادي",
  },
];

const results = [];

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find(
    (x) => x.email && x.email.toLowerCase() === email.toLowerCase()
  ) || null;
}

for (const u of users) {
  process.stdout.write(`\n⏳ جارٍ إنشاء: ${u.label} (${u.email})\n`);
  try {
    // 1) إنشاء أو تحديث المستخدم عبر الـ Admin API الرسمي
    let uid;
    let existing = await findUserByEmail(u.email);
    if (!existing) {
      const { data: created, error: authErr } =
        await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: {
            full_name: u.profile.full_name,
            role: u.role,
          },
        });
      if (authErr) throw authErr;
      uid = created.user.id;
      process.stdout.write(`   ✅ تم الإنشاء في auth.users (UUID: ${uid.slice(0, 8)}…)\n`);
    } else {
      uid = existing.id;
      const { error: updErr } = await supabase.auth.admin.updateUserById(uid, {
        password: u.password,
        email_confirm: true,
        user_metadata: {
          full_name: u.profile.full_name,
          role: u.role,
        },
      });
      if (updErr) throw updErr;
      process.stdout.write(
        `   ✅ كان موجوداً مسبقاً → تم تحديث كلمة المرور (UUID: ${uid.slice(0, 8)}…)\n`
      );
    }

    // 2) profile in public.profiles
    //    ✅ مرن: إن لم يكن الجدول موجوداً بعد (حساب جديد لم يُشغّل Migration)
    //       لا يُفشل العملية بل يطبع تحذيراً واضحاً للمستخدم.
    try {
      const { error: profErr } = await supabase
        .from("profiles")
        .upsert(
          {
            id: uid,
            full_name: u.profile.full_name,
            phone:     u.profile.phone,
            company:   u.profile.company,
            city:      u.profile.city,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      if (profErr) {
        if (profErr.message && profErr.message.includes("Could not find")) {
          process.stdout.write(
            `   ⚠️  [خطأ متوقع - حساب جديد] جدول profiles لم يُنشأ بعد.\n` +
            `      → الحل: شغّل Migration الأساسي أولاً (SQL file: 20260915100000_full_platform_upgrade.sql)\n` +
            `         ثم أعد تشغيل هذا السكربت مرة أخرى — سيقوم بإكمال بيانات البروفايل فوراً.\n`
          );
        } else {
          throw profErr;
        }
      } else {
        process.stdout.write(`   ✅ تم حفظ profile في public.profiles\n`);
      }
    } catch (innerErr) {
      const innerMsg = innerErr && innerErr.message ? innerErr.message : String(innerErr);
      if (innerMsg.includes("Could not find")) {
        process.stdout.write(
          `   ⚠️  [خطأ متوقع - حساب جديد] جدول profiles لم يُنشأ بعد. شغّل Migration أولاً ثم أعد التشغيل.\n`
        );
      } else {
        throw innerErr;
      }
    }

    // 3) الدور في public.user_roles
    try {
      const { error: roleErr } = await supabase
        .from("user_roles")
        .upsert(
          {
            user_id:    uid,
            role:       u.role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (roleErr) {
        if (roleErr.message && roleErr.message.includes("Could not find")) {
          process.stdout.write(
            `   ⚠️  [خطأ متوقع] جدول user_roles غير موجود. شغّل Migration ثم أعد التشغيل.\n`
          );
        } else {
          throw roleErr;
        }
      } else {
        process.stdout.write(`   ✅ تم تعيين الدور: ${u.role.toUpperCase()}\n`);
      }
    } catch (innerErr) {
      const innerMsg = innerErr && innerErr.message ? innerErr.message : String(innerErr);
      if (innerMsg.includes("Could not find")) {
        process.stdout.write(
          `   ⚠️  [خطأ متوقع] جدول user_roles غير موجود — شغّل Migration أولاً.\n`
        );
      } else {
        throw innerErr;
      }
    }

    results.push({ ...u, status: "OK", userId: uid });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    process.stderr.write(`   ❌ فشل: ${msg}\n`);
    results.push({ ...u, status: "ERROR", err: msg });
  }
}

// ============== طباعة النتيجة النهائية الجميلة ==============
process.stdout.write(
  "\n" + "=".repeat(64) +
  "\n📋 النتيجة النهائية — مستخدمي الأدوار التجريبيين:\n" +
  "=".repeat(64) + "\n"
);
for (const r of results) {
  if (r.status === "OK") {
    process.stdout.write(`\n✅ ${r.label}\n`);
    process.stdout.write(`   البريد       : ${r.email}\n`);
    process.stdout.write(`   كلمة المرور  : ${r.password}\n`);
    process.stdout.write(`   الدور        : ${r.role.toUpperCase()}\n`);
    process.stdout.write(`   الاسم الكامل : ${r.profile.full_name}\n`);
  } else {
    process.stdout.write(`\n❌ ${r.label} : ${r.err}\n`);
  }
}
process.stdout.write(
  "\n\n".padEnd(1, "") +
  "=".repeat(64) + "\n" +
  "💡 افتح الآن http://localhost:8080/auth وسجّل الدخول ببيانات الأعلى.\n" +
  "   • admin@open-loopsa.com  → كل الصفحات في /admin/*\n" +
  "   • staff@open-loopsa.com  → طلبات/حجوزات/مكتبة/موافقات/CMS\n" +
  "   • user@open-loopsa.com   → لوحة المستخدم فقط في /dashboard\n" +
  "=".repeat(64) + "\n"
);
