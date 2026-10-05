import pg from "pg";
const { Client } = pg;

const password = process.argv[2] || "9A182SlQ0Zfo1yRX";

const client = new Client({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("✅ Connected to Supabase DB (SSL)");

console.log("\n=== 1) عدد الإشعارات غير المقروءة لكل مستخدم ===");
const q1 = await client.query(`
  SELECT
    u.id AS user_id,
    u.email,
    ur.role,
    COUNT(n.id) FILTER (WHERE n.read_at IS NULL) AS unread_count,
    COUNT(n.id) AS total_notif
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.notifications n ON n.user_id = u.id
  GROUP BY u.id, u.email, ur.role
  ORDER BY ur.role NULLS LAST;
`);
console.table(q1.rows);

console.log("\n=== 2) آخر 10 إشعارات في الجدول ===");
const q2 = await client.query(`
  SELECT n.id, n.title, substring(n.body, 1, 50) AS body_preview, n.link,
         n.created_at, n.read_at, u.email AS user_email
  FROM public.notifications n
  LEFT JOIN auth.users u ON u.id = n.user_id
  ORDER BY n.created_at DESC
  LIMIT 10;
`);
console.table(q2.rows);

console.log("\n=== 3) عدد الحجوزات الجديدة + الطلبات الجديدة (تأكيد البادجات الجانبية) ===");
const q3 = await client.query(`
  SELECT 'bookings_new' AS metric, COUNT(*) AS count FROM public.bookings WHERE status = 'new'
  UNION ALL
  SELECT 'requests_new', COUNT(*) FROM public.requests WHERE status::text = 'new';
`);
console.table(q3.rows);

await client.end();
console.log("\n✅ Disconnected");
