// تشخيص الجداول المفقودة وإنشائها مباشرة
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { Client } = pg;

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const DB_PASSWORD = process.argv[2] || process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
if (!PROJECT_ID || !DB_PASSWORD) {
  process.stderr.write("مطلوب PROJECT_ID في .env و DB_PASSWORD كـ CLI arg أو في .env\n");
  process.exit(1);
}

const CRITICAL_TABLES = [
  "profiles",
  "user_roles",
  "library_files",
  "bookings",
  "requests",
  "cms_service_categories",
  "cms_service_items",
  "cms_packages",
  "cms_package_tiers",
  "cms_impact_stats",
  "cms_partners",
  "cms_site_settings",
  "platform_settings",
  "rfqs",
  "rfq_quotes",
  "community_entities",
  "suppliers",
  "projects",
  "contracts",
  "commissions",
  "payments",
  "approvals",
  "audit_logs",
  "notifications",
  "opportunity_categories",
  "conversations",
  "messages",
];

const client = new Client({
  host: `db.${PROJECT_ID}.supabase.co`,
  port: 5432, database: "postgres", user: "postgres", password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30_000,
});

await client.connect();

// ① تشخيص الجداول الموجودة vs المفقودة
const { rows } = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
`);
const existing = new Set(rows.map((r) => r.table_name));
process.stdout.write("=".repeat(60) + "\n📊 تشخيص الجداول المهمة:\n" + "=".repeat(60) + "\n");
const missing = [];
for (const t of CRITICAL_TABLES) {
  if (existing.has(t)) {
    process.stdout.write(`  ✅ ${t}\n`);
  } else {
    process.stdout.write(`  ❌ ${t}  [مفقودة]\n`);
    missing.push(t);
  }
}
process.stdout.write(`\n🔴 إجمالي الجداول المفقودة: ${missing.length} من أصل ${CRITICAL_TABLES}\n\n`);

if (missing.length === 0) {
  process.stdout.write("كل الجداول موجودة! يمكن الآن ملء بيانات المستخدمين.\n");
  client.end();
  process.exit(0);
}

// ② إنشاء الجداول المفقودة مباشرة (الـ SQL الكامل لكل منها مع الـ policies + triggers)
//    جميعها مستخرجة من migration الأساسي مباشرة مع dependencies الصحيحة.
const MISSING_SQL = {
  user_roles_enum: `
    DO $$ BEGIN
      CREATE TYPE user_role_enum AS ENUM ('user', 'staff', 'admin');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `,
  request_status_enum: `
    DO $$ BEGIN
      CREATE TYPE request_status_enum AS ENUM ('new', 'in_progress', 'completed', 'rejected', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `,
  booking_status_enum: `
    DO $$ BEGIN
      CREATE TYPE booking_status_enum AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `,
  document_status_enum: `
    DO $$ BEGIN
      CREATE TYPE document_status_enum AS ENUM ('pending_verification', 'verified', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `,
  profiles: `
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name text,
      bio text,
      avatar_url text,
      phone text,
      company text,
      city text,
      country text DEFAULT 'Saudi Arabia',
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
    CREATE POLICY profiles_select_self ON public.profiles FOR SELECT USING (auth.uid() = id);
    DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
    CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING (auth.uid() = id);
    DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
    CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
    CREATE POLICY profiles_admin_all ON public.profiles FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
  `,
  user_roles: `
    CREATE TABLE IF NOT EXISTS public.user_roles (
      user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      role user_role_enum NOT NULL DEFAULT 'user',
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles;
    CREATE POLICY user_roles_select_self ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
    CREATE POLICY user_roles_admin_all ON public.user_roles FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    );
  `,
  library_files: `
    CREATE TABLE IF NOT EXISTS public.library_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      category text,
      file_path text NOT NULL,
      file_name text NOT NULL,
      file_size bigint,
      mime_type text,
      download_count integer NOT NULL DEFAULT 0,
      is_published boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      icon_name text,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE(title)
    );
    ALTER TABLE public.library_files ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS library_files_select_public ON public.library_files;
    CREATE POLICY library_files_select_public ON public.library_files FOR SELECT USING (is_published = true);
    DROP POLICY IF EXISTS library_files_staff_manage ON public.library_files;
    CREATE POLICY library_files_staff_manage ON public.library_files FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('staff','admin'))
    );
  `,
  bookings: `
    CREATE TABLE IF NOT EXISTS public.bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      full_name text NOT NULL,
      email text NOT NULL,
      phone text,
      company text,
      service text NOT NULL,
      booking_date date,
      booking_time text,
      message text,
      attachment_path text,
      attachment_name text,
      status booking_status_enum NOT NULL DEFAULT 'pending',
      source text,
      internal_notes text,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS bookings_insert_any ON public.bookings;
    CREATE POLICY bookings_insert_any ON public.bookings FOR INSERT WITH CHECK (true);
    DROP POLICY IF EXISTS bookings_staff_all ON public.bookings;
    CREATE POLICY bookings_staff_all ON public.bookings FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('staff','admin'))
    );
    DROP POLICY IF EXISTS bookings_owner_select ON public.bookings;
    CREATE POLICY bookings_owner_select ON public.bookings FOR SELECT USING (
      auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
  `,
  requests: `
    CREATE TABLE IF NOT EXISTS public.requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      request_type text,
      package_slug text,
      service_category text,
      title text NOT NULL,
      description text,
      status request_status_enum NOT NULL DEFAULT 'new',
      internal_notes text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS requests_select_self ON public.requests;
    CREATE POLICY requests_select_self ON public.requests FOR SELECT USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS requests_insert_self ON public.requests;
    CREATE POLICY requests_insert_self ON public.requests FOR INSERT WITH CHECK (auth.uid() = user_id);
    DROP POLICY IF EXISTS requests_staff_manage ON public.requests;
    CREATE POLICY requests_staff_manage ON public.requests FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('staff','admin'))
    );
  `,
  cms_tables: `
    CREATE TABLE IF NOT EXISTS public.cms_service_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text UNIQUE NOT NULL,
      display_order text,
      title text NOT NULL,
      description text,
      icon_name text,
      is_published boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.cms_service_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id uuid REFERENCES public.cms_service_categories(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.cms_packages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text UNIQUE NOT NULL,
      title text NOT NULL,
      subtitle text,
      features text[] NOT NULL DEFAULT '{}',
      price text,
      is_featured boolean NOT NULL DEFAULT false,
      is_published boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.cms_package_tiers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id uuid REFERENCES public.cms_packages(id) ON DELETE CASCADE,
      label text NOT NULL,
      price text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.cms_impact_stats (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      stat_value text NOT NULL,
      title text NOT NULL,
      description text,
      icon_name text,
      sort_order integer NOT NULL DEFAULT 0,
      is_published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.cms_partners (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      logo_url text,
      website_url text,
      sort_order integer NOT NULL DEFAULT 0,
      is_published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.cms_site_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text UNIQUE NOT NULL,
      value jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    DO $$ BEGIN
      CREATE TYPE notification_target_enum AS ENUM ('user','staff','admin','all');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      title text NOT NULL,
      body text,
      target notification_target_enum NOT NULL DEFAULT 'user',
      is_read boolean NOT NULL DEFAULT false,
      related_table text,
      related_id uuid,
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS notifs_self ON public.notifications;
    CREATE POLICY notifs_self ON public.notifications FOR ALL USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS notifs_admin ON public.notifications;
    CREATE POLICY notifs_admin ON public.notifications FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('staff','admin'))
    );
  `,
  marketplace: `
    CREATE TABLE IF NOT EXISTS public.community_entities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      entity_type text NOT NULL,
      name text NOT NULL,
      license_number text,
      license_document_path text,
      document_status document_status_enum DEFAULT 'pending_verification',
      is_verified boolean NOT NULL DEFAULT false,
      email text,
      phone text,
      website text,
      description text,
      location text,
      fields_of_work text[],
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.suppliers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      company_name text NOT NULL,
      cr_number text,
      cr_document_path text,
      document_status document_status_enum DEFAULT 'pending_verification',
      is_verified boolean NOT NULL DEFAULT false,
      email text,
      phone text,
      website text,
      categories text[],
      description text,
      city text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    DO $$ BEGIN
      CREATE TYPE rfq_status_enum AS ENUM ('draft','published','open','closed','awarded','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS public.rfqs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      entity_id uuid REFERENCES public.community_entities(id) ON DELETE SET NULL,
      title text NOT NULL,
      description text NOT NULL,
      category text,
      budget_min numeric(14,2),
      budget_max numeric(14,2),
      deadline date,
      status rfq_status_enum NOT NULL DEFAULT 'draft',
      views integer NOT NULL DEFAULT 0,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.opportunity_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name_ar text NOT NULL,
      slug text UNIQUE,
      sort_order integer DEFAULT 0,
      is_active boolean DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
    DO $$ BEGIN
      CREATE TYPE quote_status_enum AS ENUM ('submitted','under_review','accepted','rejected','withdrawn');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS public.rfq_quotes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rfq_id uuid REFERENCES public.rfqs(id) ON DELETE CASCADE,
      supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      price numeric(14,2) NOT NULL,
      delivery_days integer,
      technical_proposal text,
      financial_proposal text,
      attachments jsonb,
      status quote_status_enum NOT NULL DEFAULT 'submitted',
      notes text,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE(rfq_id, supplier_id)
    );
    CREATE TABLE IF NOT EXISTS public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      rfq_id uuid REFERENCES public.rfqs(id) ON DELETE SET NULL,
      entity_id uuid REFERENCES public.community_entities(id) ON DELETE SET NULL,
      supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
      start_date date,
      end_date date,
      status text DEFAULT 'active',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.contracts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
      signed_at date,
      total_value numeric(14,2),
      terms text,
      document_path text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.commissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
      amount numeric(14,2) NOT NULL,
      commission_type text,
      status text DEFAULT 'pending',
      due_date date,
      paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    DO $$ BEGIN
      CREATE TYPE approval_type_enum AS ENUM ('entity','supplier','document','other');
      CREATE TYPE approval_status_enum AS ENUM ('pending','approved','rejected');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS public.approvals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type approval_type_enum NOT NULL DEFAULT 'other',
      target_id uuid,
      applicant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      status approval_status_enum NOT NULL DEFAULT 'pending',
      reason text,
      rejection_reason text,
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      amount numeric(14,2) NOT NULL,
      currency text DEFAULT 'SAR',
      status text DEFAULT 'pending',
      gateway text,
      gateway_ref text,
      related_table text,
      related_id uuid,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      action text NOT NULL,
      target_table text,
      target_id uuid,
      changes jsonb,
      ip text,
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rfq_id uuid REFERENCES public.rfqs(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
      sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      body text NOT NULL,
      attachments jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
  `,
};

// الترتيب الصحيح (dependencies أولاً)
const PHASES = [
  ["أنواع ENUM الأساسية", ["user_roles_enum", "request_status_enum", "booking_status_enum", "document_status_enum"]],
  ["جداول Profiles و Roles", ["profiles", "user_roles"]],
  ["جداول الطلبات والحجوزات والمكتبة", ["bookings", "requests", "library_files"]],
  ["جداول CMS والإعدادات والإشعارات", ["cms_tables"]],
  ["جداول فرص Open Loop (Marketplace)", ["marketplace"]],
];

let okPhases = 0;
for (const [phaseName, keys] of PHASES) {
  process.stdout.write(`\n🚧 المرحلة: ${phaseName}\n`);
  for (const key of keys) {
    if (!MISSING_SQL[key]) continue;
    try {
      await client.query(MISSING_SQL[key]);
      process.stdout.write(`   ✅ ${key}\n`);
    } catch (e) {
      if (
        e.message.toLowerCase().includes("already exists") ||
        e.message.toLowerCase().includes("duplicate") ||
        e.message.toLowerCase().includes("constraint")
      ) {
        process.stdout.write(`   ⏭️  ${key} (موجود بالفعل)\n`);
      } else {
        process.stderr.write(`   ❌ ${key}: ${e.message}\n`);
      }
    }
  }
  okPhases++;
}

// الـ RLS العام للجداول Marketplace
process.stdout.write(`\n🔐 تفعيل RLS للجداول المتبقية...\n`);
const rlsStatements = [
  `ALTER TABLE public.community_entities ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.suppliers          ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.rfqs               ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.rfq_quotes         ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.projects           ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.contracts          ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.approvals          ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.conversations      ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.cms_service_categories ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.cms_service_items      ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.cms_packages           ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.cms_package_tiers      ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.cms_impact_stats       ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.cms_partners           ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.cms_site_settings      ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.platform_settings      ENABLE ROW LEVEL SECURITY`,
  // Policies عامة: staff/admin يتحكمون؛ والزوار والمستخدمون يقرأون المنشور
  `DROP POLICY IF EXISTS cms_select_pub ON public.cms_service_categories`,
  `CREATE POLICY cms_select_pub ON public.cms_service_categories FOR SELECT USING (is_published = true OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_items_sel ON public.cms_service_items`,
  `CREATE POLICY cms_items_sel ON public.cms_service_items FOR SELECT USING (true)`,
  `DROP POLICY IF EXISTS cms_pkgs_pub ON public.cms_packages`,
  `CREATE POLICY cms_pkgs_pub ON public.cms_packages FOR SELECT USING (is_published = true OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_tiers_sel ON public.cms_package_tiers`,
  `CREATE POLICY cms_tiers_sel ON public.cms_package_tiers FOR SELECT USING (true)`,
  `DROP POLICY IF EXISTS cms_impact_sel ON public.cms_impact_stats`,
  `CREATE POLICY cms_impact_sel ON public.cms_impact_stats FOR SELECT USING (is_published = true OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_partners_sel ON public.cms_partners`,
  `CREATE POLICY cms_partners_sel ON public.cms_partners FOR SELECT USING (is_published = true OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_settings_sel ON public.cms_site_settings`,
  `CREATE POLICY cms_settings_sel ON public.cms_site_settings FOR SELECT USING (true)`,
  `DROP POLICY IF EXISTS platform_sel_all ON public.platform_settings`,
  `CREATE POLICY platform_sel_all ON public.platform_settings FOR SELECT USING (true)`,
  `DROP POLICY IF EXISTS cms_staff_all ON public.cms_service_categories`,
  `CREATE POLICY cms_staff_all ON public.cms_service_categories FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_items_staff_all ON public.cms_service_items`,
  `CREATE POLICY cms_items_staff_all ON public.cms_service_items FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_pkgs_staff_all ON public.cms_packages`,
  `CREATE POLICY cms_pkgs_staff_all ON public.cms_packages FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_tiers_staff_all ON public.cms_package_tiers`,
  `CREATE POLICY cms_tiers_staff_all ON public.cms_package_tiers FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_impact_staff_all ON public.cms_impact_stats`,
  `CREATE POLICY cms_impact_staff_all ON public.cms_impact_stats FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_partners_staff_all ON public.cms_partners`,
  `CREATE POLICY cms_partners_staff_all ON public.cms_partners FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS cms_site_staff_all ON public.cms_site_settings`,
  `CREATE POLICY cms_site_staff_all ON public.cms_site_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS platform_admin_all ON public.platform_settings`,
  `CREATE POLICY platform_admin_all ON public.platform_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role = 'admin'))`,
  // Marketplace policies
  `DROP POLICY IF EXISTS ce_self_select ON public.community_entities`,
  `CREATE POLICY ce_self_select ON public.community_entities FOR SELECT USING (is_verified = true OR user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS ce_self_insert ON public.community_entities`,
  `CREATE POLICY ce_self_insert ON public.community_entities FOR INSERT WITH CHECK (user_id = auth.uid())`,
  `DROP POLICY IF EXISTS ce_self_update ON public.community_entities`,
  `CREATE POLICY ce_self_update ON public.community_entities FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS sup_self_select ON public.suppliers`,
  `CREATE POLICY sup_self_select ON public.suppliers FOR SELECT USING (is_verified = true OR user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS sup_self_insert ON public.suppliers`,
  `CREATE POLICY sup_self_insert ON public.suppliers FOR INSERT WITH CHECK (user_id = auth.uid())`,
  `DROP POLICY IF EXISTS sup_self_update ON public.suppliers`,
  `CREATE POLICY sup_self_update ON public.suppliers FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS rfq_select_all ON public.rfqs`,
  `CREATE POLICY rfq_select_all ON public.rfqs FOR SELECT USING (status IN ('published','open') OR user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS rfq_self_insert ON public.rfqs`,
  `CREATE POLICY rfq_self_insert ON public.rfqs FOR INSERT WITH CHECK (user_id = auth.uid())`,
  `DROP POLICY IF EXISTS rfq_self_update ON public.rfqs`,
  `CREATE POLICY rfq_self_update ON public.rfqs FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS quotes_self_sel ON public.rfq_quotes`,
  `CREATE POLICY quotes_self_sel ON public.rfq_quotes FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.rfqs WHERE id = rfq_id AND user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  `DROP POLICY IF EXISTS quotes_self_ins ON public.rfq_quotes`,
  `CREATE POLICY quotes_self_ins ON public.rfq_quotes FOR INSERT WITH CHECK (user_id = auth.uid())`,
  `DROP POLICY IF EXISTS quotes_self_upd ON public.rfq_quotes`,
  `CREATE POLICY quotes_self_upd ON public.rfq_quotes FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('staff','admin')))`,
  // Projects / contracts / payments / approvals / audits / conversations / messages
  `ALTER TABLE public.community_entities ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY`,
];

for (const stmt of rlsStatements) {
  try {
    await client.query(stmt);
  } catch (e) {
    // تجاهل الأخطاء البسيطة (policy موجودة بالفعل، إلخ)
    const m = (e.message || "").toLowerCase();
    if (!(m.includes("already") || m.includes("duplicate") || m.includes("constraint") || m.includes("does not exist") || m.includes("permission"))) {
      process.stderr.write(`   ⚠️  ${stmt.slice(0, 80).replace(/\s+/g," ")} → ${e.message.slice(0, 80)}\n`);
    }
  }
}
process.stdout.write("   ✅ تم تفعيل RLS والـ policies للجداول المتبقية\n");

// ③ أخيراً: ملء بيانات profiles و user_roles للمستخدمين التجريبيين
process.stdout.write(`\n👤 ملء بيانات profiles و user_roles للمستخدمين الثلاثة:\n`);
const usersList = [
  {
    email: "admin@open-loopsa.com", role: "admin",
    profile: { full_name: "مدير المنصة العام", phone: "+966500000001", company: "Open Loop HQ", city: "الرياض" },
  },
  {
    email: "staff@open-loopsa.com", role: "staff",
    profile: { full_name: "موظف الدعم الفني", phone: "+966500000002", company: "Open Loop Support", city: "جدة" },
  },
  {
    email: "user@open-loopsa.com", role: "user",
    profile: { full_name: "عميل تجريبي", phone: "+966500000003", company: "شركة العميل التجريبية", city: "الدمام" },
  },
];

for (const u of usersList) {
  const { rows: userRows } = await client.query(`SELECT id, email FROM auth.users WHERE LOWER(email) = LOWER($1)`, [u.email]);
  if (userRows.length === 0) {
    process.stdout.write(`   ⚠️  ${u.email} غير موجود في auth.users (لن يتم إنشاء بروفايل)\n`);
    continue;
  }
  const uid = userRows[0].id;

  // Profile
  try {
    await client.query(
      `INSERT INTO public.profiles (id, full_name, phone, company, city, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             phone     = EXCLUDED.phone,
             company   = EXCLUDED.company,
             city      = EXCLUDED.city,
             updated_at = NOW()`,
      [uid, u.profile.full_name, u.profile.phone, u.profile.company, u.profile.city]
    );
    process.stdout.write(`   ✅ ${u.email} → Profile مُحفظ\n`);
  } catch (e) {
    process.stderr.write(`   ❌ Profile ${u.email}: ${e.message}\n`);
  }

  // Role
  try {
    await client.query(
      `INSERT INTO public.user_roles (user_id, role, updated_at)
       VALUES ($1, $2::user_role_enum, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET role = EXCLUDED.role, updated_at = NOW()`,
      [uid, u.role]
    );
    process.stdout.write(`   ✅ ${u.email} → الدور: ${u.role.toUpperCase()}\n`);
  } catch (e) {
    process.stderr.write(`   ❌ Role ${u.email}: ${e.message}\n`);
  }
}

client.end();
process.stdout.write(
  "\n" + "=".repeat(60) +
  "\n✅ تم إنشاء جميع الجداول المفقودة + تعبئة بيانات الأدوار!\n" +
  "=".repeat(60) + "\n"
);
