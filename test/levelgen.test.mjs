// Validates that the procedural generator produces solvable, in-bounds levels.
// Run with: `npm test`.
//
// Solvability is asserted three independent ways so the check isn't circular with
// the generator's own simulate()-based filtering:
//   1. simulate() reaches the goal (the same check the generator uses), AND
//   2. every gap is within reachForStep() for its height change (pure math), AND
//   3. urchin platforms satisfy the geometric "land clear, hop, exit" invariants,
//   plus `fallbacks === 0` proves the by-construction path carries every level
//   without the trivial safety net ever standing in.
import { generateLevel, simulate, reachForStep } from "../js/levelgen.js";

const DIFFS = ["kid", "normal"];
// Dense coverage of the early game, plus a sparse sweep well past the point where
// levels get very long — this guards the (previously latent) "long level times out
// the simulator and silently falls back to a flat layout" regression.
const DENSE = 300;
const SWEEP = [400, 514, 600, 800, 1000, 1500, 2000, 3000];

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
      // (2) Independent solvability: gap within the jump reach for its height change.
      const reach = reachForStep(prev.y - p.y);
      if (gap > reach + 0.5) {
        problems.push(`platform ${i} gap ${gap.toFixed(1)} exceeds reach ${reach.toFixed(1)}`);
      }
    }
  }
  const last = L.platforms[L.platforms.length - 1];
  if (L.goal.x < last.x || L.goal.x > last.x + last.w) problems.push("goal not on last platform");

  // (3) Independent urchin invariants: the otter must land clear of the urchin
  // (past the worst-case incoming overshoot) and have room to hop it before the exit.
  for (const u of L.urchins) {
    const p = L.platforms.find((q) => Math.abs(u.y - q.y) < 1 && u.x >= q.x - 1 && u.x <= q.x + q.w + 1);
    if (!p) { problems.push(`urchin at x=${u.x.toFixed(0)} not on a platform top`); continue; }
    const fromLeft = u.x - p.x;
    const toRight = p.x + p.w - u.x;
    if (fromLeft < 240) problems.push(`urchin only ${fromLeft.toFixed(0)} from left edge (< 240)`);
    if (toRight < 230) problems.push(`urchin only ${toRight.toFixed(0)} from right edge (< 230)`);
  }

  if (problems.length) failures.push(`${label}: ${problems.join("; ")}`);
}

const stripMeta = (L) => { const { meta, ...rest } = L; return rest; };

function checkLevel(level, difficulty) {
  total++;
  const label = `${difficulty} L${level}`;
  const L = generateLevel({ level, difficulty });

  // Determinism: regenerating yields an identical layout.
  if (JSON.stringify(stripMeta(L)) !== JSON.stringify(stripMeta(generateLevel({ level, difficulty })))) {
    failures.push(`${label}: not deterministic`);
  }
  if (!simulate(L)) { unsolvable++; failures.push(`${label}: UNSOLVABLE`); }
  checkBounds(L, label);
  if (L.meta.fallback) { fallbacks++; failures.push(`${label}: used fallback layout`); }
  if (L.meta.attempts > 1) multiAttempt++;
  maxAttempts = Math.max(maxAttempts, L.meta.attempts);
}

for (const difficulty of DIFFS) {
  for (let level = 1; level <= DENSE; level++) checkLevel(level, difficulty);
  for (const level of SWEEP) checkLevel(level, difficulty);
}

console.log(`\nOtter Jump — level generator test`);
console.log(`  generated:     ${total} levels (${DENSE} dense + ${SWEEP.length} swept, × ${DIFFS.length} difficulties)`);
console.log(`  swept levels:  ${SWEEP.join(", ")}`);
console.log(`  solvable:      ${total - unsolvable}/${total}`);
console.log(`  fallback used: ${fallbacks}`);
console.log(`  needed >1 try: ${multiAttempt} (max ${maxAttempts} attempts)`);

if (failures.length || unsolvable > 0 || fallbacks > 0) {
  console.error(`\n✗ ${failures.length} problem(s):`);
  for (const f of failures.slice(0, 25)) console.error(`   - ${f}`);
  if (failures.length > 25) console.error(`   ...and ${failures.length - 25} more`);
  process.exit(1);
}
console.log(`\n✓ all ${total} generated levels are solvable, in-bounds, and built by construction\n`);
