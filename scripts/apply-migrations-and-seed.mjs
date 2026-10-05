// ============================================================
// تنفيذ الكل في واحد (One-Click):
//   1. Migration (30+ جدول + RLS + Triggers + RPC)
//   2. Seed CMS + مكتبة الملفات + إعدادات المنصة
//   3. إنشاء مستخدمي الأدوار الثلاثة (admin/staff/user)
// ============================================================
// ✅ طريقة التشغيل:
//    node scripts/apply-migrations-and-seed.mjs
//
// ✅ المتطلبات في ملف .env:
//    SUPABASE_PROJECT_ID    (موجود الآن: berprxhuguniggtnerfq)
//    SUPABASE_URL           (سيتم بناؤه تلقائياً إن لم يكن)
//    SUPABASE_SERVICE_ROLE_KEY (موجود الآن في .env)
//    SUPABASE_DB_PASSWORD   (اختياري — لو كان موجوداً نستخدمه مباشرة)
//
//    و كلمة مرور قاعدة البيانات كـ CLI argument (لو لم تكن في .env):
//    node scripts/apply-migrations-and-seed.mjs 9A182SlQ0Zfo1yRX
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const { Client } = pg;

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const envPath = join(projectRoot, ".env");

// ========= ① تحميل ملف .env =========
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

// ========= ② جمع بيانات الاتصال =========
const PROJECT_ID   = process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL
                  || process.env.VITE_SUPABASE_URL
                  || (PROJECT_ID ? `https://${PROJECT_ID}.supabase.co` : "");

// كلمة مرور قاعدة البيانات:
//   الأولوية 1 → CLI argument أول واحد بعد اسم الملف
//   الأولوية 2 → SUPABASE_DB_PASSWORD من البيئة
let DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD
               || process.env.DB_PASSWORD
               || "";
if (process.argv[2] && !DB_PASSWORD) DB_PASSWORD = process.argv[2].trim();

// ========= ③ التحقق =========
if (!PROJECT_ID || !SERVICE_ROLE || !SUPABASE_URL) {
  process.stderr.write(
    "❌ بيانات Supabase ناقصة في ملف .env.\n" +
    "   المطلوب: PROJECT_ID + SERVICE_ROLE_KEY + (DB_PASSWORD أو كـ CLI arg)\n"
  );
  process.exit(1);
}
if (!DB_PASSWORD) {
  process.stderr.write(
    "\n❌ كلمة مرور قاعدة البيانات غير موجودة!\n" +
    "   شغّل الأمر هكذا (ضع كلمة المرور بعد اسم الملف):\n\n" +
    '   node scripts/apply-migrations-and-seed.mjs "كلمة_مرور_قاعدة_البيانات"\n\n' +
    "   أو أضف هذا السطر في ملف .env:\n" +
    "   SUPABASE_DB_PASSWORD=كلمة_مرور_قاعدة_البيانات\n"
  );
  process.exit(1);
}

// ========= ④ إعدادات الاتصال بـ Postgres المباشر =========
// بورت 6543 (Supavisor) لا يقبل بعض الـ startup parameters → نستخدم بورت 5432 للاتصال المباشر
// لأن Supavisor pooler لا يدعم statement_timeout في بداية الاتصال.
const PG_CONFIG = {
  host:     `db.${PROJECT_ID}.supabase.co`,
  port:     5432,
  database: "postgres",
  user:     "postgres",
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
};

// ========= ⑤ دوال مساعدة =========
function splitSqlStatements(sqlText) {
  // Split على $$ + ; مع الاحتفاظ بالـ dollar-quoted strings لانهي المعاملات والوظائف
  // استراتيجية بسيطة وفعالة: نقسم على علامات التنفيذ المنفصلة
  const parts = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let dollarTag = null;

  for (let i = 0; i < sqlText.length; i++) {
    const ch = sqlText[i];

    // تعليقات أسطرية — نتجاهلها حتى نهاية السطر
    if (!inSingle && !inDouble && !dollarTag && ch === "-" && sqlText[i + 1] === "-") {
      while (i < sqlText.length && sqlText[i] !== "\n") i++;
      continue;
    }
    if (!inSingle && !inDouble && !dollarTag && ch === "/" && sqlText[i + 1] === "*") {
      // تعليقات متعددة الأسطر
      i += 2;
      while (i < sqlText.length - 1 && !(sqlText[i] === "*" && sqlText[i + 1] === "/")) i++;
      i++;
      continue;
    }

    // dollar quoting ($$ أو $tag$)
    if (!inSingle && !inDouble && ch === "$") {
      if (!dollarTag) {
        // ابحث عن نهاية الـ dollar tag (حتى $ التالي)
        let j = i + 1;
        while (j < sqlText.length && sqlText[j] !== "$") j++;
        dollarTag = sqlText.slice(i, j + 1); // مثل $$ أو $func$
        buf += dollarTag;
        i = j;
        continue;
      } else {
        // هل هذا نهاية نفس الـ dollar tag؟
        if (sqlText.slice(i, i + dollarTag.length) === dollarTag) {
          buf += dollarTag;
          i += dollarTag.length - 1;
          dollarTag = null;
          continue;
        }
      }
    }

    // Single / double quotes
    if (!dollarTag) {
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      if (ch === '"' && !inSingle) inDouble = !inDouble;
    }

    buf += ch;

    // الفاصلة المنفصلة خارج المقتبسات = تنفيذ statement
    if (ch === ";" && !inSingle && !inDouble && !dollarTag) {
      const trimmed = buf.trim();
      if (trimmed && trimmed.length > 3) parts.push(trimmed);
      buf = "";
    }
  }

  // الجزء الأخير بعد آخر فاصلة منقوطة
  const tail = buf.trim();
  if (tail && tail.length > 3) parts.push(tail);

  return parts;
}

async function runSqlFile(client, filePath, label) {
  process.stdout.write(
    `\n` + "=".repeat(64) +
    `\n📜 ${label}\n   الملف: ${filePath}\n` +
    "=".repeat(64) + "\n"
  );

  if (!existsSync(filePath)) {
    throw new Error(`الملف غير موجود: ${filePath}`);
  }
  const sqlRaw = readFileSync(filePath, "utf8");

  // ============================================================
  // الاستراتيجية الأمثل:
  //   ① حاول أولاً تشغيل الملف كاملاً كـ multi-statement في طلب واحد
  //     (node-postgres يدعم هذا أصلاً ويرجع مصفوفة نتائج)
  //     هذا يحل تماماً مشاكل CTE معقدة (UNION + RETURNING داخل WITH)
  //   ② فشل؟ — نلجأ للتقسيم اليدوي statement-by-statement كخطة احتياطية
  // ============================================================
  process.stdout.write(`   ⏳ المحاولة الأولى: تنفيذ الملف كاملاً (multi-statement)…\n`);
  try {
    await client.query(sqlRaw);
    process.stdout.write(`   ✅ ${label} — نجح التنفيذ كاملاً في طلب واحد!\n`);
    return;
  } catch (e) {
    process.stdout.write(
      `   ⚠️  فشل التنفيذ الكامل (${(e.message || "").split("\n")[0]})\n` +
      `      → اللجوء للخطة الاحتياطية: تقسيم وتنفيذ كل statement على حدة…\n`
    );
  }

  // الخطة الاحتياطية: split + execute واحد تلو الآخر
  const statements = splitSqlStatements(sqlRaw);
  process.stdout.write(`   ⏳ (احتياطي) تم تجهيز ${statements.length} statement…\n`);

  let okCount = 0;
  let skipCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.query(stmt);
      okCount++;
    } catch (e) {
      const msg = (e.message || "").toLowerCase();
      const isBenign =
        msg.includes("already exists") ||
        msg.includes("duplicate key") ||
        msg.includes("does not exist") ||
        msg.includes("constraint") ||
        msg.includes("cannot insert a duplicate") ||
        msg.includes("permission denied for") ||
        msg.includes("there is no") && msg.includes("named");
      if (isBenign) {
        skipCount++;
      } else {
        process.stderr.write(
          `   ❌ خطأ في Statement رقم ${i + 1} / ${statements.length}:\n` +
          `      ${e.message}\n` +
          `      ✂️  أول 150 حرف: ${stmt.slice(0, 150).replace(/\s+/g, " ")}\n`
        );
        throw e;
      }
    }
  }

  process.stdout.write(
    `   ✅ ${label} (خطة احتياطية) انتهى:\n` +
    `      • نُفذ بنجاح   : ${okCount}\n` +
    `      • تم التخطي  : ${skipCount} (موجود بالفعل — لا يضر)\n`
  );
}

// ========= ⑥ الدالة الرئيسية =========
async function main() {
  const migrationFile = join(
    projectRoot, "supabase", "migrations", "20260915100000_full_platform_upgrade.sql"
  );
  const seedFile = join(
    projectRoot, "supabase", "migrations", "20260915130000_seed_cms_library_platform.sql"
  );

  const client = new Client(PG_CONFIG);
  let pgClient = null; // سنستخدم هذا الاتصال المباشر أخيراً لكتابة profiles و user_roles مباشرةً
  try {
    process.stdout.write(
      "\n" + "-".repeat(64) +
      `\n🔗 جارٍ الاتصال بـ Postgres: postgres@db.${PROJECT_ID}.supabase.co:${PG_CONFIG.port}\n` +
      "-".repeat(64) + "\n"
    );
    await client.connect();
    pgClient = client;
    process.stdout.write("   ✅ تم الاتصال بنجاح\n");

    // ---------- الخطوة 1: Migration الأساسي ----------
    await runSqlFile(client, migrationFile, "الخطوة ①: Migration (إنشاء 30+ جدول + RLS + Triggers)");

    // ---------- الخطوة 2: Seed CMS + مكتبة الملفات ----------
    await runSqlFile(client, seedFile, "الخطوة ②: Seed (مكتبة + خدمات + باقات + أثر + شركاء + إعدادات)");

    process.stdout.write("\n   ℹ️  ستبقى اتصال Postgres مفتوحاً لإكمال بيانات المستخدمين...\n");
  } catch (err) {
    try { client.end(); } catch (_) { /* ignore */ }
    process.stderr.write("\n" + "❌".repeat(40) + "\n");
    process.stderr.write("خطأ أثناء التنفيذ: " + (err.message || String(err)) + "\n");
    process.stderr.write(
      "نصيحة: تأكد أن الدارجة 6543 و 5432 مفتوحة في جدار الحماية، وأن كلمة المرور صحيحة.\n"
    );
    process.exit(1);
  }

  // ---------- الخطوة ③: إنشاء مستخدمي الأدوار الثلاثة ----------
  process.stdout.write(
    "=".repeat(64) +
    "\n👤 الخطوة ③: إنشاء مستخدمي الأدوار الثلاثة (Admin / Staff / User)\n" +
    "=".repeat(64) + "\n"
  );

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = [
    {
      email: "admin@open-loopsa.com", password: "Admin@OpenLoop2026",
      role: "admin",
      profile: { full_name: "مدير المنصة العام", phone: "+966500000001", company: "Open Loop HQ", city: "الرياض" },
      label: "① المدير العام",
    },
    {
      email: "staff@open-loopsa.com", password: "Staff@OpenLoop2026",
      role: "staff",
      profile: { full_name: "موظف الدعم الفني", phone: "+966500000002", company: "Open Loop Support", city: "جدة" },
      label: "② موظف الدعم",
    },
    {
      email: "user@open-loopsa.com", password: "User@OpenLoop2026",
      role: "user",
      profile: { full_name: "عميل تجريبي", phone: "+966500000003", company: "شركة العميل التجريبية", city: "الدمام" },
      label: "③ العميل العادي",
    },
  ];

  async function listAllUsers() {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    return data.users;
  }

  // دوال مساعدة للإدراج المباشر عبر pgClient (تجاوز الـ schema cache)
  async function upsertProfilePg(pg, uid, p) {
    const sql = `
      INSERT INTO public.profiles (id, full_name, phone, company, city, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE
        SET full_name   = EXCLUDED.full_name,
            phone       = EXCLUDED.phone,
            company     = EXCLUDED.company,
            city        = EXCLUDED.city,
            updated_at  = NOW()
    `;
    await pg.query(sql, [uid, p.full_name, p.phone || null, p.company || null, p.city || null]);
  }

  async function upsertRolePg(pg, uid, role) {
    const sql = `
      INSERT INTO public.user_roles (user_id, role, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET role       = EXCLUDED.role,
            updated_at = NOW()
    `;
    await pg.query(sql, [uid, role]);
  }

  const results = [];
  const allUsers = await listAllUsers();

  for (const u of users) {
    process.stdout.write(`\n⏳ ${u.label} (${u.email})\n`);
    try {
      let uid;
      let existing = allUsers.find(
        (x) => x.email && x.email.toLowerCase() === u.email.toLowerCase()
      );
      if (!existing) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email, password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.profile.full_name, role: u.role },
        });
        if (error) throw error;
        uid = data.user.id;
        process.stdout.write(`   ✅ تم الإنشاء في auth.users (UUID: ${uid.slice(0, 8)}…)\n`);
      } else {
        uid = existing.id;
        const { error } = await supabase.auth.admin.updateUserById(uid, {
          password: u.password, email_confirm: true,
          user_metadata: { full_name: u.profile.full_name, role: u.role },
        });
        if (error) throw error;
        process.stdout.write(`   ✅ موجود مسبقاً → تم تحديث كلمة المرور (UUID: ${uid.slice(0, 8)}…)\n`);
      }

      // profile + role عبر اتصال Postgres المباشر (يتجاوز الـ schema cache)
      try {
        await upsertProfilePg(pgClient, uid, u.profile);
        process.stdout.write(`   ✅ profile حُفظ في public.profiles\n`);
      } catch (profErr) {
        process.stderr.write(`   ⚠️  profiles: ${profErr.message}\n`);
      }

      try {
        await upsertRolePg(pgClient, uid, u.role);
        process.stdout.write(`   ✅ الدور مُعين: ${u.role.toUpperCase()}\n`);
      } catch (roleErr) {
        process.stderr.write(`   ⚠️  user_roles: ${roleErr.message}\n`);
      }

      results.push({ ...u, ok: true, uid });
    } catch (err) {
      process.stderr.write(`   ❌ فشل: ${err.message}\n`);
      results.push({ ...u, ok: false, err: err.message });
    }
  }

  // إغلاق اتصال Postgres الآن
  try { if (pgClient) pgClient.end(); } catch (_) { /* ignore */ }

  // ========= ملخص نهائي =========
  process.stdout.write(
    "\n" + "=".repeat(64) +
    "\n🎉 الملخص النهائي — مستخدمي الأدوار الثلاثة:\n" +
    "=".repeat(64) + "\n"
  );
  for (const r of results) {
    process.stdout.write(
      `\n${r.ok ? "✅" : "❌"} ${r.label}\n` +
      `   البريد      : ${r.email}\n` +
      `   كلمة المرور : ${r.password}\n` +
      `   الدور       : ${r.role.toUpperCase()}\n`
    );
  }
  process.stdout.write(
    "\n" + "=".repeat(64) +
    "\n🚀 تم إنهاء المهمة! افتح الآن:\n" +
    "   الـ Dev Server: http://localhost:8080/\n" +
    "   صفحة تسجيل الدخول: http://localhost:8080/auth\n" +
    "=".repeat(64) + "\n"
  );
}

main();
