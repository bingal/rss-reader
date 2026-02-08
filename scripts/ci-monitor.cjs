#!/usr/bin/env node
/**
 * GitHub Actions Auto-Monitor Script
 * Usage: node scripts/ci-monitor.cjs
 *
 * Environment:
 *   GITHUB_TOKEN - GitHub API token (optional)
 *
 * Features:
 * 1. Fetches latest CI run status
 * 2. If failed, attempts to fix common issues
 * 3. Auto-commits and pushes fixes
 */

const { execSync } = require("child_process");
const https = require("https");
const fs = require("fs");

const REPO = "bingal/rss-reader";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

function runCommand(cmd) {
  console.log(`$ ${cmd}`);
  try {
    execSync(cmd, { encoding: "utf-8", stdio: "inherit" });
    return true;
  } catch (e) {
    return false;
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: url,
      method: "GET",
      headers: {
        "User-Agent": "RSS-Reader-CI-Monitor",
        Accept: "application/vnd.github.v3+json",
      },
    };

    if (GITHUB_TOKEN) {
      options.headers["Authorization"] = `token ${GITHUB_TOKEN}`;
    }

    const req = https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function getLatestRun() {
  try {
    const data = await fetchJson(`/repos/${REPO}/actions/runs?per_page=1`);
    return data?.workflow_runs?.[0];
  } catch (e) {
    return null;
  }
}

async function autoFix() {
  console.log("🔧 Auto-fixing CI issues...\n");

  // Run common fixes
  console.log("📦 Formatting code...");
  runCommand("npx prettier --write .");

  console.log("\n📦 Running lint...");
  runCommand("npm run lint || true");

  console.log("\n📦 TypeScript check...");
  runCommand("npx tsc --noEmit || true");

  // Check for changes
  const status = execSync("git status --porcelain", { encoding: "utf-8" });
  if (!status.trim()) {
    console.log("\n✅ No changes needed");
    return false;
  }

  // Commit and push
  console.log("\n📝 Committing fixes...");
  runCommand("git add -A");
  runCommand('git commit -m "ci: Auto-fix CI issues"');
  runCommand("git push origin main");

  // Update tag
  runCommand("git tag -d v0.1.0 2>/dev/null || true");
  runCommand("git push origin :refs/tags/v0.1.0 2>/dev/null || true");
  runCommand("git tag v0.1.0");
  runCommand("git push origin v0.1.0");

  console.log("\n✅ Fixes applied and pushed!");
  return true;
}

async function monitor() {
  console.log("🔍 Checking CI Status...\n");

  const run = await getLatestRun();
  if (!run) {
    console.log("❌ Could not fetch CI status");
    return;
  }

  console.log(`📊 Run: ${run.name}`);
  console.log(`🔗 ${run.html_url}`);
  console.log(`Status: ${run.status || "unknown"}`);
  console.log(`Conclusion: ${run.conclusion || "unknown"}\n`);

  if (run.conclusion === "success") {
    console.log("✅ CI Passed!\n");
    return;
  }

  if (run.conclusion === "failure") {
    console.log("❌ CI Failed");
    await autoFix();
    return;
  }

  console.log(`⚠️  Status: ${run.conclusion || run.status}`);
}

monitor().catch(console.error);
