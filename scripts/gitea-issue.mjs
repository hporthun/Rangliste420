#!/usr/bin/env node
/**
 * Gitea-Issue-Workflow-Helper.
 *
 * Wird von Claude Code in den Sessions benutzt, um Issues zu lesen + zu
 * schließen, ohne dass der User in jeder neuen Session den Token paste-en
 * muss. Token kommt aus `.env` als `GITEA_TOKEN` (siehe `.env.example`).
 *
 * Usage:
 *   node scripts/gitea-issue.mjs list                    — alle offenen Issues
 *   node scripts/gitea-issue.mjs list --all              — auch geschlossene
 *   node scripts/gitea-issue.mjs view <number>           — Detail eines Issues
 *   node scripts/gitea-issue.mjs close <number>          — Issue schließen
 *   node scripts/gitea-issue.mjs reopen <number>         — wieder öffnen
 *   node scripts/gitea-issue.mjs create <title> <body>   — neues Issue anlegen
 *                                                          (Body kann via "-" aus stdin)
 *
 * Antworten kommen als JSON auf stdout, damit sie ggf. mit `jq` o.ä.
 * weiterverarbeitet werden können.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = "HPorthun/Rangliste420";
const BASE = `https://git.pt-systemhaus.de/api/v1/repos/${REPO}/issues`;

// ── Token aus .env oder process.env laden ─────────────────────────────────────

function readEnvFile() {
  const envPath = resolve(HERE, "..", ".env");
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const raw of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = readEnvFile();
const TOKEN = process.env.GITEA_TOKEN ?? fileEnv.GITEA_TOKEN;
if (!TOKEN) {
  console.error(
    "Kein GITEA_TOKEN gefunden. Setze ihn in .env oder als Umgebungsvariable.\n" +
      "Beispiel:\n" +
      '  GITEA_TOKEN="paste-token-hier"\n' +
      "\nToken erstellen: Gitea → Settings → Applications → Generate New Token"
  );
  process.exit(2);
}

// ── HTTP-Helper ───────────────────────────────────────────────────────────────

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `token ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gitea API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

// ── Commands ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];

async function listIssues({ state }) {
  const issues = await api(`?state=${state}&type=issues&limit=50`);
  for (const i of issues) {
    console.log(`#${i.number}  [${i.state}]  ${i.title}`);
  }
  if (issues.length === 0) console.log("(keine Issues)");
}

async function viewIssue(num) {
  const i = await api(`/${num}`);
  console.log(`#${i.number}  ${i.title}`);
  console.log(`State:     ${i.state}`);
  console.log(`Created:   ${i.created_at}`);
  if (i.assignee) console.log(`Assignee:  ${i.assignee.login}`);
  if (i.milestone) console.log(`Milestone: ${i.milestone.title}`);
  console.log("\n" + (i.body || "(no body)"));
}

async function setState(num, state) {
  const i = await api(`/${num}`, {
    method: "PATCH",
    body: JSON.stringify({ state }),
  });
  console.log(`#${i.number}  state=${i.state}  ${i.title}`);
}

async function createIssue(title, body) {
  const i = await api(``, {
    method: "POST",
    body: JSON.stringify({ title, body }),
  });
  console.log(`#${i.number}  ${i.title}`);
  console.log(i.html_url);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

try {
  if (cmd === "list") {
    const state = args.includes("--all") ? "all" : "open";
    await listIssues({ state });
  } else if (cmd === "view" && args[1]) {
    await viewIssue(args[1]);
  } else if (cmd === "close" && args[1]) {
    await setState(args[1], "closed");
  } else if (cmd === "reopen" && args[1]) {
    await setState(args[1], "open");
  } else if (cmd === "create" && args[1]) {
    const title = args[1];
    let body = args[2] ?? "";
    if (body === "-") body = await readStdin();
    await createIssue(title, body);
  } else {
    console.error(
      "Usage:\n" +
        "  node scripts/gitea-issue.mjs list [--all]\n" +
        "  node scripts/gitea-issue.mjs view <number>\n" +
        "  node scripts/gitea-issue.mjs close <number>\n" +
        "  node scripts/gitea-issue.mjs reopen <number>\n" +
        "  node scripts/gitea-issue.mjs create <title> <body|->"
    );
    process.exit(1);
  }
} catch (e) {
  console.error("Fehler:", e instanceof Error ? e.message : String(e));
  process.exit(1);
}
