/**
 * Verifies DATABASE_URL (e.g. Supabase pooler) from your machine.
 * Run from repo: cd maxis-api && npm run db:ping
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function loadRootEnv(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main(): Promise<void> {
  loadRootEnv();
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[db:ping] FAIL — DATABASE_URL is not set (add maxis-api/.env from .env.example).");
    process.exit(1);
  }

  const { prisma } = await import("../src/prisma.js");

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[db:ping] OK — TCP/TLS to Postgres succeeded (SELECT 1).");
    const n = await prisma.merchant.count();
    console.log(`[db:ping] OK — merchants table readable (${n} row(s)).`);
    console.log("[db:ping] Supabase / DATABASE_URL is working from this machine.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[db:ping] FAIL — database not reachable.");
    console.error(msg);
    console.error(
      "\nHints: resume Supabase project if paused; fix DATABASE_URL password; VPN/firewall; use Supabase Connect strings.",
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
