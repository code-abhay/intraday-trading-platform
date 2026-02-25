#!/usr/bin/env node
/**
 * Watches for file changes and auto-commits + pushes to trigger Vercel deploy.
 * Run: npm run auto-sync
 * Flow: Code change → auto commit → auto push → Vercel auto-deploys
 */

const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEBOUNCE_MS = 3000;

let debounceTimer = null;
let isCommitting = false;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: "inherit",
      shell: true,
      cwd: ROOT,
    });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

async function commitAndPush() {
  if (isCommitting) return;
  isCommitting = true;

  try {
    const { execSync } = require("child_process");
    const status = execSync("git status --short", { cwd: ROOT, encoding: "utf8" });
    if (!status.trim()) {
      isCommitting = false;
      return;
    }

    const msg = `auto: sync ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    await run("git", ["add", "-A"]);
    await run("git", ["commit", "-m", msg]);
    await run("git", ["push", "origin", "main"]);
    console.log(`\n✓ Pushed → Vercel will auto-deploy\n`);
  } catch (err) {
    if (!err.message?.includes("nothing to commit") && !err.message?.includes("Exit 1")) {
      console.error("[auto-sync] Error:", err.message);
    }
  } finally {
    isCommitting = false;
  }
}

function schedule() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    commitAndPush();
  }, DEBOUNCE_MS);
}

async function main() {
  let chokidar;
  try {
    chokidar = require("chokidar");
  } catch {
    console.error("Run: npm install");
    process.exit(1);
  }

  const watcher = chokidar.watch(
    ["app", "lib", "public", "docs", "scripts", "package.json", "next.config.mjs", "tsconfig.json", "vercel.json"],
    {
      cwd: ROOT,
      ignored: /(node_modules|\.next|\.git|\.vercel)/,
      persistent: true,
    }
  );

  watcher.on("change", schedule);
  watcher.on("add", schedule);

  console.log("Auto-sync: watching for changes. Push to main → Vercel deploys.\n");
}

main().catch(console.error);
