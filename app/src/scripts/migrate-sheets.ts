/**
 * migrate-sheets.ts — One-time migration from Google Sheets to Supabase
 *
 * Usage:
 *   npx tsx src/scripts/migrate-sheets.ts
 *
 * Required env vars:
 *   GOOGLE_SHEETS_API_KEY     — API key with Sheets read access
 *   GOOGLE_SPREADSHEET_ID     — The spreadsheet ID from the Google Sheets URL
 *   NEXT_PUBLIC_SUPABASE_URL  — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS)
 *
 * What it migrates:
 *   1. Profiles sheet → profiles table
 *   2. Engine_Tracker sheet → tracker_entries table
 *   3. Global_Job_Bank sheet → global_job_bank table
 *   4. Lane_Role_Bank sheet → lane_role_bank table
 *
 * Run this ONCE after setting up the Supabase schema.
 * It uses upserts so it's safe to re-run (idempotent).
 */

import { createClient } from "@supabase/supabase-js";

const SHEETS_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SHEETS_KEY || !SPREADSHEET_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required env vars. See script header for details.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Google Sheets Reader ───────────────────────────────────────────

async function readSheet(sheetName: string): Promise<Record<string, string>[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${SHEETS_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to read sheet "${sheetName}": ${res.status} ${res.statusText}`);
    return [];
  }
  const data = await res.json();
  const rows: string[][] = data.values ?? [];
  if (rows.length < 2) return [];

  const headers = rows[0].map((h: string) => h.trim());
  return rows.slice(1).map((row: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = (row[i] ?? "").trim();
    });
    return obj;
  });
}

// ─── Profiles ───────────────────────────────────────────────────────

async function migrateProfiles() {
  console.log("\n📋 Migrating Profiles...");
  const rows = await readSheet("Profiles");
  if (rows.length === 0) {
    console.log("  No profile rows found.");
    return;
  }

  let migrated = 0;
  for (const row of rows) {
    const profileId = row["profile_id"] || row["Profile ID"] || row["profileId"];
    if (!profileId) continue;

    const entry = {
      profile_id: profileId,
      display_name: row["display_name"] || row["Display Name"] || row["name"] || profileId,
      email: row["email"] || row["Email"] || null,
      role: (row["role"] || row["Role"] || "client").toLowerCase(),
      status: mapStatus(row["status"] || row["Status"] || "active"),
      accept_remote: toBool(row["accept_remote"] ?? row["Remote"] ?? "true"),
      accept_hybrid: toBool(row["accept_hybrid"] ?? row["Hybrid"] ?? "false"),
      accept_onsite: toBool(row["accept_onsite"] ?? row["Onsite"] ?? "false"),
      preferred_countries: toArray(row["preferred_countries"] || row["Countries"] || ""),
      preferred_cities: toArray(row["preferred_cities"] || row["Cities"] || ""),
      preferred_locations: toArray(row["preferred_locations"] || row["Locations"] || ""),
      current_city: row["current_city"] || row["City"] || "",
      salary_min: toNum(row["salary_min"] || row["Salary Min"] || "0"),
      banned_keywords: toArray(row["banned_keywords"] || row["Banned Keywords"] || ""),
      top_skills: toArray(row["top_skills"] || row["Top Skills"] || ""),
      skill_keywords_plus: toArray(row["skill_keywords_plus"] || row["Skill+"] || ""),
      skill_keywords_minus: toArray(row["skill_keywords_minus"] || row["Skill-"] || ""),
      skill_profile_text: row["skill_profile_text"] || row["Skill Profile"] || "",
      role_tracks: safeJson(row["role_tracks"] || row["Role Tracks"] || "[]"),
      lane_controls: safeJson(row["lane_controls"] || row["Lane Controls"] || "[]"),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(entry, { onConflict: "profile_id" });

    if (error) {
      console.error(`  ✗ Profile ${profileId}: ${error.message}`);
    } else {
      migrated++;
    }
  }
  console.log(`  ✓ Migrated ${migrated}/${rows.length} profiles`);
}

// ─── Tracker Entries ────────────────────────────────────────────────

async function migrateTracker() {
  console.log("\n📋 Migrating Tracker Entries...");
  const rows = await readSheet("Engine_Tracker");
  if (rows.length === 0) {
    console.log("  No tracker rows found.");
    return;
  }

  // Need profile_id → UUID mapping
  const profileMap = await getProfileMap();
  let migrated = 0;

  for (const row of rows) {
    const pid = row["profile_id"] || row["Profile ID"] || row["profileId"];
    const supabaseId = profileMap.get(pid);
    if (!supabaseId) {
      console.warn(`  ⚠ No profile found for "${pid}", skipping tracker entry`);
      continue;
    }

    const entry = {
      profile_id: supabaseId,
      company: row["company"] || row["Company"] || "Unknown",
      title: row["title"] || row["Title"] || row["Job Title"] || "",
      url: row["url"] || row["URL"] || row["Job URL"] || null,
      source: row["source"] || row["Source"] || null,
      location: row["location"] || row["Location"] || null,
      role_type: row["role_type"] || row["Work Mode"] || row["work_mode"] || null,
      lane_label: row["lane_label"] || row["Lane"] || row["lane"] || null,
      job_summary: row["job_summary"] || row["Summary"] || row["summary"] || null,
      why_fit: row["why_fit"] || row["WhyFit"] || null,
      salary: row["salary"] || row["Salary"] || null,
      good_fit: row["good_fit"] || row["GoodFit"] || "",
      notes: row["notes"] || row["Notes"] || "",
      status: mapTrackerStatus(row["status"] || row["Status"] || "prospect"),
      date_applied: row["date_applied"] || row["Date Applied"] || "",
    };

    const { error } = await supabase.from("tracker_entries").insert(entry);
    if (error) {
      console.error(`  ✗ Tracker "${entry.title}" for ${pid}: ${error.message}`);
    } else {
      migrated++;
    }
  }
  console.log(`  ✓ Migrated ${migrated}/${rows.length} tracker entries`);
}

// ─── Global Job Bank ────────────────────────────────────────────────

async function migrateJobBank() {
  console.log("\n📋 Migrating Global Job Bank...");
  const rows = await readSheet("Global_Job_Bank");
  if (rows.length === 0) {
    console.log("  No job bank rows found.");
    return;
  }

  let migrated = 0;
  for (const row of rows) {
    const entry = {
      title: row["title"] || row["Title"] || row["Job Title"] || null,
      company: row["company"] || row["Company"] || null,
      url: row["url"] || row["URL"] || null,
      source: row["source"] || row["Source"] || null,
      location: row["location"] || row["Location"] || null,
      work_mode: row["work_mode"] || row["Work Mode"] || null,
      job_family: row["job_family"] || row["Job Family"] || null,
      description_snippet: row["description_snippet"] || row["Description"] || null,
      job_summary: row["job_summary"] || row["Summary"] || null,
    };

    if (!entry.title && !entry.url) continue;

    const { error } = await supabase.from("global_job_bank").insert(entry);
    if (error) {
      console.error(`  ✗ Job Bank "${entry.title}": ${error.message}`);
    } else {
      migrated++;
    }
  }
  console.log(`  ✓ Migrated ${migrated}/${rows.length} job bank entries`);
}

// ─── Lane Role Bank ─────────────────────────────────────────────────

async function migrateLanes() {
  console.log("\n📋 Migrating Lane Role Bank...");
  const rows = await readSheet("Lane_Role_Bank");
  if (rows.length === 0) {
    console.log("  No lane rows found.");
    return;
  }

  let migrated = 0;
  for (const row of rows) {
    const entry = {
      lane_key: row["lane_key"] || row["Lane Key"] || row["laneKey"] || "",
      role_name: row["role_name"] || row["Role Name"] || row["roleName"] || "",
      aliases: toArray(row["aliases"] || row["Aliases"] || ""),
      is_active: toBool(row["is_active"] ?? row["Active"] ?? "true"),
      source: row["source"] || row["Source"] || "migration",
    };

    if (!entry.lane_key || !entry.role_name) continue;

    const { error } = await supabase.from("lane_role_bank").insert(entry);
    if (error) {
      console.error(`  ✗ Lane "${entry.lane_key}/${entry.role_name}": ${error.message}`);
    } else {
      migrated++;
    }
  }
  console.log(`  ✓ Migrated ${migrated}/${rows.length} lane roles`);
}

// ─── Helpers ────────────────────────────────────────────────────────

async function getProfileMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from("profiles").select("id, profile_id");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.profile_id, row.id);
  }
  return map;
}

function toBool(v: string): boolean {
  return ["true", "yes", "1", "on"].includes(v.toLowerCase());
}

function toNum(v: string): number {
  const n = parseInt(v.replace(/[^0-9.-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function toArray(v: string): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON */ }
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
}

function mapStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower.includes("lock") || lower.includes("inactive")) return "inactive_soft_locked";
  return "active";
}

function mapTrackerStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower.includes("applied")) return "applied";
  if (lower.includes("interview") && lower.includes("1")) return "interview_1";
  if (lower.includes("interview") && lower.includes("2")) return "interview_2";
  if (lower.includes("final")) return "final_round";
  if (lower.includes("offer")) return "offer";
  if (lower.includes("reject")) return "rejected";
  if (lower.includes("ghost")) return "ghosted";
  return "prospect";
}

// ─── Run ────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Sygnalist Data Migration: Google Sheets → Supabase");
  console.log(`   Spreadsheet: ${SPREADSHEET_ID}`);
  console.log(`   Supabase: ${SUPABASE_URL}`);

  await migrateProfiles();
  await migrateTracker();
  await migrateJobBank();
  await migrateLanes();

  console.log("\n✅ Migration complete!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
