// Creates a firm and adds a member by email in Supabase. Requires
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The user must have signed in at
// least once (or be invited) so an auth user exists for the email.
//   npx tsx scripts/onboard.ts --name "Rosillo Hermanos" --kind correduria --email persona@despacho.es [--budget 2000000]
import { createClient } from "@supabase/supabase-js";

function arg(name: string, def?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (def !== undefined) return def;
  throw new Error(`Falta --${name}`);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son necesarias");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const name = arg("name");
  const kind = arg("kind");
  const email = arg("email").toLowerCase();
  const budget = Number(arg("budget", "2000000"));
  if (kind !== "correduria" && kind !== "asesoria") throw new Error("--kind debe ser correduria o asesoria");

  const firm = await db.from("firms").insert({ name, kind, monthly_token_budget: budget }).select("id").single();
  if (firm.error) throw new Error(firm.error.message);

  let userId: string | null = null;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!userId) {
    const invited = await db.auth.admin.inviteUserByEmail(email);
    if (invited.error) throw new Error(invited.error.message);
    userId = invited.data.user.id;
    console.log(`invitación enviada a ${email}`);
  }
  const m = await db.from("memberships").upsert({ firm_id: firm.data.id, user_id: userId, role: "owner" });
  if (m.error) throw new Error(m.error.message);
  console.log(`despacho ${firm.data.id} creado; ${email} es owner`);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
