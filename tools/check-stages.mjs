// Validates js/stages.js. Usage: node tools/check-stages.mjs [--show N]
import { STAGES } from "../js/stages.js";

const ALLOWED = new Set([".", "B", "S", "W", "T", "I", "E"]);
const errors = [];
const warnings = [];
const err = (n, m) => errors.push(`stage ${n}: ${m}`);

const showIdx = process.argv.indexOf("--show");
if (showIdx !== -1) {
  const n = Number(process.argv[showIdx + 1]);
  const st = STAGES[n - 1];
  if (!st) { console.error("no such stage"); process.exit(1); }
  const head = "   " + [...Array(26).keys()].map((c) => String(c % 10)).join("");
  console.log(`Stage ${n}  enemies: ${st.enemies}`);
  console.log(head);
  st.map.forEach((row, r) => console.log(String(r).padStart(2) + " " + row));
  process.exit(0);
}

if (STAGES.length !== 35) errors.push(`expected 35 stages, got ${STAGES.length}`);

// Spawn areas (row, col) 2x2 blocks. Ice is passable, so it is tolerated (warned) there.
const spawns = [];
for (const c0 of [0, 12, 24]) spawns.push(["enemy spawn", 0, c0]);
spawns.push(["player spawn", 24, 8]);

STAGES.forEach((st, idx) => {
  const n = idx + 1;
  const { map, enemies } = st;
  if (!Array.isArray(map) || map.length !== 26) { err(n, `map has ${map?.length} rows`); return; }
  const counts = { B: 0, S: 0, W: 0, T: 0, I: 0 };
  map.forEach((row, r) => {
    if (typeof row !== "string" || row.length !== 26) err(n, `row ${r} length ${row?.length}`);
    for (const ch of row) {
      if (!ALLOWED.has(ch)) err(n, `row ${r} bad char '${ch}'`);
      if (ch in counts) counts[ch]++;
    }
  });
  for (let r = 0; r < 26; r++) for (let c = 0; c < 26; c++) {
    const ch = map[r]?.[c];
    const isEagle = (r === 24 || r === 25) && (c === 12 || c === 13);
    if (isEagle && ch !== "E") err(n, `eagle cell (${r},${c}) is '${ch}'`);
    if (!isEagle && ch === "E") err(n, `stray E at (${r},${c})`);
  }
  // base wall
  for (const [r, c] of [[23, 11], [23, 12], [23, 13], [23, 14], [24, 11], [25, 11], [24, 14], [25, 14]])
    if (map[r]?.[c] !== "B") err(n, `base wall (${r},${c}) is '${map[r]?.[c]}'`);
  for (const [name, r0, c0] of spawns) for (let r = r0; r < r0 + 2; r++) for (let c = c0; c < c0 + 2; c++) {
    const ch = map[r]?.[c];
    if (ch === ".") continue;
    if (ch === "I") warnings.push(`stage ${n}: ${name} cell (${r},${c}) is ice`);
    else err(n, `${name} cell (${r},${c}) is '${ch}'`);
  }
  if (typeof enemies !== "string" || enemies.length !== 20 || /[^bfpa]/.test(enemies))
    err(n, `bad enemies '${enemies}'`);
  const ec = { b: 0, f: 0, p: 0, a: 0 };
  for (const ch of enemies ?? "") if (ch in ec) ec[ch]++;
  console.log(
    `stage ${String(n).padStart(2)}: brick=${counts.B} steel=${counts.S} water=${counts.W} trees=${counts.T} ice=${counts.I} | ` +
    `basic=${ec.b} fast=${ec.f} power=${ec.p} armor=${ec.a}`
  );
});

if (warnings.length) console.log("\nWarnings:\n  " + [...new Set(warnings)].join("\n  "));
if (errors.length) { console.error("\nFAILED:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("\nAll checks passed.");
