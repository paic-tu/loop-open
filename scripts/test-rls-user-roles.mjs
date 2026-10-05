import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const envPath = join(rootDir, ".env");
const envVars = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const idx = s.indexOf("=");
    if (idx < 0) continue;
    const k = s.slice(0, idx).trim();
    const v = s.slice(idx + 1).trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    envVars[k] = v;
  }
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_ANON_KEY || envVars.SUPABASE_ANON_KEY;

console.log("URL:", SUPABASE_URL ? SUPABASE_URL.slice(0, 40) + "..." : "❌ MISSING");
console.log("ANON:", SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 10) + "..." : "❌ MISSING");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing URL or ANON KEY in env");
  process.exit(1);
}

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const email = process.argv[2] || "admin@open-loopsa.com";
  const password = process.argv[3] || "Admin@OpenLoop2026";

  console.log(`\n=== Signing in via SUPABASE ANON REST as ${email} ===`);
  const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.log("  ❌ Sign in FAIL:", signInError.message);
    process.exit(1);
  }
  const uid = signInData.user?.id;
  console.log(`  ✅ Signed in! user_id=${uid}`);
  console.log(`  ✅ JWT sub claim = ${signInData.session?.access_token ? "(present)" : "❌"}`);

  console.log("\n=== SELECT * FROM user_roles (ANON CLIENT + USER AUTHENTICATED) ===");
  const r1 = await supabaseAnon.from("user_roles").select("*");
  console.log(`  data.length=${r1.data?.length ?? 0}, error=${r1.error ? r1.error.message : null}`);
  if (r1.data) for (const r of r1.data) console.log("    row:", JSON.stringify(r));

  console.log("\n=== SELECT role FROM user_roles WHERE user_id = auth.uid() ===");
  const r2 = await supabaseAnon.from("user_roles").select("role").eq("user_id", uid);
  console.log(`  data.length=${r2.data?.length ?? 0}, error=${r2.error ? r2.error.message : null}`);
  if (r2.data) for (const r of r2.data) console.log("    row:", JSON.stringify(r));

  console.log("\n=== SELECT * FROM profiles WHERE id = auth.uid() ===");
  const r3 = await supabaseAnon.from("profiles").select("*").eq("id", uid);
  console.log(`  data.length=${r3.data?.length ?? 0}, error=${r3.error ? r3.error.message : null}`);
  if (r3.data?.[0]) console.log("    profile:", JSON.stringify(r3.data[0]).slice(0, 300));

  console.log("\n=== Testing hasAtLeast equivalent ===");
  const roles = ["user"];
  for (const r of r2.data ?? []) {
    if (r.role === "admin" || r.role === "staff") roles.push(r.role);
  }
  const isStaff = roles.includes("staff") || roles.includes("admin");
  console.log(`  roles list = ${JSON.stringify(roles)}`);
  console.log(`  hasAtLeast("staff") = ${isStaff}`);
  console.log(`  ✅ Expected: TRUE for admin ✅`);

  await supabaseAnon.auth.signOut();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
