// Simple migration runner — no external migration library needed.
// Reads every .sql file in this folder in filename order and executes it.
//
// Usage:
//   cd server
//   node migrations/run.js

const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

async function runMigrations() {
  const dir = __dirname;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // 001_..., 002_... run in order

  if (files.length === 0) {
    console.log("No .sql migration files found.");
    process.exit(0);
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const sql = fs.readFileSync(fullPath, "utf8");
    console.log(`\n▶ Running ${file} ...`);
    try {
      await pool.query(sql);
      console.log(`✅ ${file} applied successfully`);
    } catch (err) {
      console.error(`❌ Failed running ${file}`);
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log("\n🎉 All migrations applied successfully.");
  await pool.end();
  process.exit(0);
}

runMigrations();
