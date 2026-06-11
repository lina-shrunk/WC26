// scripts/update-scores.mjs
// Pulls FINISHED FIFA World Cup 2026 results from football-data.org and writes
// them into the `const RESULTS={...}` block of index.html.
//   - Group matches (ids 1-72)  -> {a:homeGoals, b:awayGoals}   (matched by team names)
//   - Knockout matches (73-104) -> {h, a, hg, ag, w}            (matched by kickoff time)
//        h/a = home & away team names (page spelling), hg/ag = goals,
//        w   = winning team name (handles extra-time / penalties)
// Run by .github/workflows/update-scores.yml (Node 20, no dependencies).
//
// Needs a free API token from https://www.football-data.org/ stored as the
// GitHub Actions secret FOOTBALL_DATA_TOKEN.

import { readFileSync, writeFileSync } from "node:fs";

const HTML_PATH = process.argv[2] || "index.html";
const API_KEY = process.env.FOOTBALL_DATA_TOKEN || "";
const COMP = "WC";

// --- name normalisation (API spelling -> page spelling) ------------------
function norm(s) {
  return String(s).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}
const ALIAS = {
  "united states": "USA", "usa": "USA",
  "korea republic": "South Korea", "south korea": "South Korea",
  "turkiye": "Turkey", "turkey": "Turkey",
  "cote d ivoire": "Ivory Coast", "ivory coast": "Ivory Coast",
  "czechia": "Czechia", "czech republic": "Czechia",
  "cabo verde": "Cape Verde", "cape verde": "Cape Verde", "cape verde islands": "Cape Verde",
  "congo dr": "DR Congo", "dr congo": "DR Congo",
  "democratic republic of congo": "DR Congo", "congo democratic republic": "DR Congo",
  "bosnia and herzegovina": "Bosnia and Herzegovina", "bosnia herzegovina": "Bosnia and Herzegovina",
  "ir iran": "Iran", "iran": "Iran", "curacao": "Curaçao",
};
function canon(name) { const n = norm(name); return ALIAS[n] || name; }

// --- read the page & extract fixtures ------------------------------------
let html = readFileSync(HTML_PATH, "utf8");

// group fixtures: id, group, home, away
const groupRe = /\{id:(\d+),d:\[[^\]]*\],g:"([A-L])",a:"([^"]*)",b:"([^"]*)"/g;
const groupFixtures = [];
let g;
while ((g = groupRe.exec(html)) !== null)
  groupFixtures.push({ id: +g[1], a: g[3], b: g[4] });

// knockout fixtures: id + kickoff UTC (from the AEST d-array, AEST = UTC+10)
const koRe = /\{id:(\d+),ko:\d+,r:"[^"]*",d:\[(\d+),(\d+),(\d+),(\d+),(\d+)\]/g;
const koFixtures = [];
let k;
while ((k = koRe.exec(html)) !== null) {
  const [, id, y, mo, d, h, mi] = k.map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - 600 * 60000; // AEST -> UTC
  koFixtures.push({ id, utcMs });
}
console.log(`Fixtures parsed: ${groupFixtures.length} group, ${koFixtures.length} knockout.`);

function findGroup(home, away) {
  const h = norm(canon(home)), a = norm(canon(away));
  for (const f of groupFixtures) {
    const fa = norm(f.a), fb = norm(f.b);
    if (fa === h && fb === a) return { id: f.id, reversed: false };
    if (fa === a && fb === h) return { id: f.id, reversed: true };
  }
  return null;
}
function findKO(utcDate) {
  const t = new Date(utcDate).getTime();
  let best = null, bestDiff = Infinity;
  for (const f of koFixtures) {
    const diff = Math.abs(f.utcMs - t);
    if (diff < bestDiff) { bestDiff = diff; best = f; }
  }
  return bestDiff <= 90 * 60000 ? best : null; // within 90 minutes
}

// --- fetch results -------------------------------------------------------
if (!API_KEY) {
  console.log("No FOOTBALL_DATA_TOKEN set — skipping (nothing written).");
  process.exit(0);
}
let data;
try {
  const res = await fetch(`https://api.football-data.org/v4/competitions/${COMP}/matches`, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) { console.log(`API ${res.status} ${res.statusText} — file unchanged.`); process.exit(0); }
  data = await res.json();
} catch (e) { console.log("API request failed — file unchanged:", e.message); process.exit(0); }

const apiMatches = Array.isArray(data.matches) ? data.matches : [];
const results = {};          // id -> result object
const unmapped = [];

for (const m of apiMatches) {
  if (m.status !== "FINISHED") continue;
  const ft = m.score && m.score.fullTime;
  if (!ft || ft.home == null || ft.away == null) continue;
  const home = m.homeTeam && m.homeTeam.name, away = m.awayTeam && m.awayTeam.name;
  if (!home || !away) continue;
  const isGroup = (m.stage || "").toUpperCase() === "GROUP_STAGE";

  if (isGroup) {
    const hit = findGroup(home, away);
    if (!hit) { unmapped.push(`[grp] ${home} v ${away}`); continue; }
    results[hit.id] = hit.reversed ? { a: ft.away, b: ft.home } : { a: ft.home, b: ft.away };
  } else {
    const hit = findKO(m.utcDate);
    if (!hit) { unmapped.push(`[ko ${m.stage}] ${home} v ${away} @ ${m.utcDate}`); continue; }
    // winner (handles ET/penalties); fall back to goals if API didn't set it
    let w = home;
    const sw = m.score && m.score.winner;
    if (sw === "AWAY_TEAM") w = away;
    else if (sw === "HOME_TEAM") w = home;
    else if (ft.away > ft.home) w = away;
    results[hit.id] = {
      h: canon(home), a: canon(away), hg: ft.home, ag: ft.away, w: canon(w),
    };
  }
}
if (unmapped.length) console.log("Could not map (skipped):", unmapped.join(" | "));

// --- fetch OFFICIAL standings (authoritative FIFA tiebreaks) -------------
let STAND = {};
try {
  const sres = await fetch(`https://api.football-data.org/v4/competitions/${COMP}/standings`, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (sres.ok) {
    const sdata = await sres.json();
    for (const s of (sdata.standings || [])) {
      if ((s.type || "") !== "TOTAL") continue;
      const gm = (s.group || "").match(/GROUP_([A-L])/i);
      if (!gm) continue;
      STAND[gm[1].toUpperCase()] = (s.table || []).map(r => ({
        t: canon(r.team && r.team.name), P: r.playedGames, W: r.won, D: r.draw,
        L: r.lost, GF: r.goalsFor, GA: r.goalsAgainst, Pts: r.points,
      }));
    }
    console.log(`Standings pulled for ${Object.keys(STAND).length} group(s).`);
  } else console.log(`Standings API ${sres.status} — STANDINGS left unchanged.`);
} catch (e) { console.log("Standings fetch failed — STANDINGS left unchanged:", e.message); }

// --- write the RESULTS + STANDINGS blocks back ---------------------------
const ids = Object.keys(results).map(Number).sort((x, y) => x - y);
const rBody = ids.map(id => {
  const r = results[id];
  return r.h !== undefined
    ? `  ${id}:{h:${JSON.stringify(r.h)},a:${JSON.stringify(r.a)},hg:${r.hg},ag:${r.ag},w:${JSON.stringify(r.w)}},`
    : `  ${id}:{a:${r.a},b:${r.b}},`;
}).join("\n");
const rBlock = ids.length ? `const RESULTS={\n${rBody}\n};` : `const RESULTS={\n};`;

if (!/const RESULTS=\{[\s\S]*?\};/.test(html)) { console.error("RESULTS block not found — aborting."); process.exit(1); }
let next = html.replace(/const RESULTS=\{[\s\S]*?\};/, rBlock);

const sLetters = Object.keys(STAND).sort();
if (sLetters.length && /const STANDINGS=\{[\s\S]*?\};/.test(next)) {
  const sBody = sLetters.map(g => `  ${g}:[` +
    STAND[g].map(r => `{t:${JSON.stringify(r.t)},P:${r.P},W:${r.W},D:${r.D},L:${r.L},GF:${r.GF},GA:${r.GA},Pts:${r.Pts}}`).join(",") +
    `],`).join("\n");
  next = next.replace(/const STANDINGS=\{[\s\S]*?\};/, `const STANDINGS={\n${sBody}\n};`);
}

const stamp = new Date().toISOString().slice(0, 10);
next = next.replace(/(Last updated:)[^*\n]*/g, `$1 ${stamp} `);

if (next === html) { console.log(`No changes — ${ids.length} results, ${sLetters.length} tables already current.`); process.exit(0); }
writeFileSync(HTML_PATH, next);
console.log(`Updated: ${ids.length} match result(s), ${sLetters.length} group table(s).`);
