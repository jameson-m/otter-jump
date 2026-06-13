// Validates that the procedural generator produces solvable, in-bounds levels
// across many levels and both difficulties. Run with: `npm test`.
import { generateLevel, simulate, reachForStep, PHYS } from "../js/levelgen.js";

const LEVELS = 300;
const DIFFS = ["kid", "normal"];

let total = 0, unsolvable = 0, fallbacks = 0, multiAttempt = 0, maxAttempts = 0;
const failures = [];

function checkBounds(L, label) {
  const problems = [];
  if (!L.platforms.length) problems.push("no platforms");
  if (L.platforms[0].x !== 0) problems.push("first platform not at x=0");

  for (let i = 0; i < L.platforms.length; i++) {
    const p = L.platforms[i];
    if (p.w <= 0) problems.push(`platform ${i} width <= 0`);
    if (p.y < 320 || p.y > 620) problems.push(`platform ${i} top ${p.y} out of band`);
    if (i > 0) {
      const prev = L.platforms[i - 1];
      const gap = p.x - (prev.x + prev.w);
      if (gap < 0) problems.push(`platform ${i} overlaps previous (gap ${gap.toFixed(1)})`);
      // Gap must be within the jump reach for its height change (the guarantee).
      const up = prev.y - p.y;
      const reach = reachForStep(up);
      if (gap > reach + 0.5) {
        problems.push(`platform ${i} gap ${gap.toFixed(1)} exceeds reach ${reach.toFixed(1)} (up ${up.toFixed(1)})`);
      }
    }
  }
  // Goal sits on the last platform.
  const last = L.platforms[L.platforms.length - 1];
  if (L.goal.x < last.x || L.goal.x > last.x + last.w) problems.push("goal not on last platform");
  // Urchins sit on a platform.
  for (const u of L.urchins) {
    const on = L.platforms.some((p) => u.x >= p.x - 1 && u.x <= p.x + p.w + 1 && Math.abs(u.y - p.y) < 1);
    if (!on) problems.push(`urchin at x=${u.x.toFixed(0)} not on a platform top`);
  }
  if (problems.length) failures.push(`${label}: ${problems.join("; ")}`);
  return problems.length === 0;
}

for (const difficulty of DIFFS) {
  for (let level = 1; level <= LEVELS; level++) {
    total++;
    const L = generateLevel({ level, difficulty });
    const label = `${difficulty} L${level}`;

    // Determinism: regenerating yields an identical layout.
    const L2 = generateLevel({ level, difficulty });
    if (JSON.stringify(stripMeta(L)) !== JSON.stringify(stripMeta(L2))) {
      failures.push(`${label}: not deterministic`);
    }

    if (!simulate(L)) { unsolvable++; failures.push(`${label}: UNSOLVABLE`); }
    checkBounds(L, label);

    if (L.meta.fallback) fallbacks++;
    if (L.meta.attempts > 1) multiAttempt++;
    maxAttempts = Math.max(maxAttempts, L.meta.attempts);
  }
}

function stripMeta(L) { const { meta, ...rest } = L; return rest; }

console.log(`\nOtter Jump — level generator test`);
console.log(`  generated:     ${total} levels (${LEVELS} × ${DIFFS.length} difficulties)`);
console.log(`  solvable:      ${total - unsolvable}/${total}`);
console.log(`  fallback used: ${fallbacks}`);
console.log(`  needed >1 try: ${multiAttempt} (max ${maxAttempts} attempts)`);

if (failures.length) {
  console.error(`\n✗ ${failures.length} problem(s):`);
  for (const f of failures.slice(0, 25)) console.error(`   - ${f}`);
  if (failures.length > 25) console.error(`   ...and ${failures.length - 25} more`);
  process.exit(1);
}
// The whole point: every generated level must be beatable, with the by-
// construction guarantee never having to fall back to the trivial layout.
if (unsolvable > 0 || fallbacks > 0) process.exit(1);
console.log(`\n✓ all ${total} generated levels are solvable and within bounds\n`);
