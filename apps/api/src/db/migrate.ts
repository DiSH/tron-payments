import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const migrationPath = join(__dirname, "migrations", "0000_initial.sql");
  const migrationSql = readFileSync(migrationPath, "utf8");
  await sql.unsafe(migrationSql);
  console.log("Migration 0000_initial applied");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
