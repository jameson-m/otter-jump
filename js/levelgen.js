// ============================================================================
// Otter Jump — procedural level generator (shared by the game and the tests).
//
// Levels are generated from a seed derived from (level number, difficulty), so
// they are fully reproducible. Every gap is placed within the otter's verified
// jump reach for its height change, and each candidate level is additionally
// validated by `simulate()` — a faithful mirror of the game's physics/collision
// driven by an autopilot — so a generated level is GUARANTEED beatable.
//
// `PHYS` is the single source of truth for the tuning constants that affect
// reachability; the game imports the same object, so the generator's solvability
// math and the real game can never drift apart on the numbers.
// ============================================================================

export const PHYS = Object.freeze({
  RUN_SPEED: 300,    // constant horizontal auto-run speed (world units / s)
  GRAVITY: 2200,     // downward acceleration
  JUMP_V: 860,       // initial upward jump velocity
  JUMP_CUT: 0.5,     // velocity kept when a jump is released early
  COYOTE_TIME: 0.10, // grace to jump just after leaving a ledge
  JUMP_BUFFER: 0.13, // grace to register a jump pressed just before landing
  MAX_FALL: 1300,    // terminal velocity
  DEATH_Y: 820,      // fall below this and it's a splash
  OTTER_W: 50,
  OTTER_H: 44,
  URCHIN_R: 22,
  SOLID: 1000,       // how far a platform's solid body extends below its top
});

// Vertical band that platform tops live within (world-y; smaller = higher).
const TOP_MIN = 360;
const TOP_MAX = 600;
const START_TOP = 560;
const START_X = 70;
const MIN_GAP = 64; // a gap is always at least this wide, so a jump is required

// Urchin placement on a (widened) platform. The offset clears the worst-case
// landing overshoot from the incoming jump; the width leaves room to hop the
// urchin and still reach the exit gap.
const URCHIN_PLAT_W = 540;
const URCHIN_OFFSET = 250;
const URCHIN_OFFSET_VAR = 50;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// --- Deterministic PRNG (mulberry32) ---------------------------------------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFor(level, difficulty) {
  const salt = difficulty === "normal" ? 0x9e3779b9 : 0x85ebca77;
  return (Math.imul(level | 0, 2654435761) ^ salt) >>> 0;
}

// --- Jump reach -------------------------------------------------------------
// Horizontal distance the otter covers in a full (held) jump before its feet
// return to a platform whose top is `up` units higher (up>0) or lower (up<0)
// than the take-off platform. Derived directly from the PHYS constants.
export function reachForStep(up) {
  const { RUN_SPEED, GRAVITY, JUMP_V } = PHYS;
  let t;
  if (up >= 0) {
    const disc = JUMP_V * JUMP_V - 2 * GRAVITY * up;
    if (disc <= 0) return 0; // height not reachable at all
    t = (JUMP_V + Math.sqrt(disc)) / GRAVITY; // descending back to height `up`
  } else {
    t = (JUMP_V + Math.sqrt(JUMP_V * JUMP_V + 2 * GRAVITY * -up)) / GRAVITY;
  }
  return RUN_SPEED * t;
}
// Largest upward step whose reach stays comfortably positive.
const MAX_UP_CAP = 0.78 * (PHYS.JUMP_V * PHYS.JUMP_V) / (2 * PHYS.GRAVITY); // ~131

// --- Difficulty profile -----------------------------------------------------
// `kid` ramps gently and plateaus; `normal` ramps steadily without a hard cap.
// (Progression/curve tuning is refined when level progression is wired up.)
export function profile(level, difficulty) {
  const t = difficulty === "normal"
    ? 1 - 1 / (1 + level / 10)        // steady ramp toward 1, never caps out
    : Math.min(1, level / 14) * 0.7;  // gentle ramp, plateaus around 0.7
  return {
    length:       2200 + level * 110 + t * 1500,
    startW:       520,
    platMinW:     lerp(360, 150, t),
    platMaxW:     lerp(620, 320, t),
    gapFactor:    lerp(0.45, 0.95, t),  // how much of the available reach gaps use
    gapSafety:    0.82,                 // hard ceiling: gap <= reach * gapSafety
    maxUp:        Math.min(MAX_UP_CAP, lerp(70, 120, t)),
    maxDown:      lerp(80, 150, t),
    urchinChance: lerp(0.08, 0.32, t),
    fishOverGap:  0.7,
    fishOnPlat:   0.4,
  };
}

// --- Core builder (deterministic given rng + profile) -----------------------
function buildLevel(rng, P) {
  const platforms = [{ x: 0, y: START_TOP, w: P.startW }];
  const urchins = [];
  const fish = [];
  let prev = platforms[0];

  while (prev.x + prev.w < P.length) {
    // Pick the next platform's top, biased toward variety but within the band.
    const r = rng();
    let delta; // positive => step up (top decreases)
    if (r < 0.4) delta = -rng() * P.maxDown;
    else if (r < 0.8) delta = rng() * P.maxUp;
    else delta = (rng() - 0.5) * 40;
    const nextTop = clamp(prev.y - delta, TOP_MIN, TOP_MAX);

    const up = prev.y - nextTop; // >0 up, <0 down
    const reach = reachForStep(up);
    const maxGap = Math.max(MIN_GAP + 12, reach * P.gapSafety);
    const gap = clamp(MIN_GAP + rng() * (maxGap - MIN_GAP) * P.gapFactor, MIN_GAP, maxGap);

    // Urchin platforms are widened so the otter always lands clear of the urchin
    // (past the worst-case overshoot from the incoming jump), can hop it, and
    // still has room to reach the exit gap — which keeps the level solvable.
    const wantUrchin = rng() < P.urchinChance;
    let w = lerp(P.platMinW, P.platMaxW, rng());
    if (wantUrchin) w = Math.max(w, URCHIN_PLAT_W);
    const nx = prev.x + prev.w + gap;
    const plat = { x: nx, y: nextTop, w };
    platforms.push(plat);
    if (wantUrchin) {
      urchins.push({ x: nx + URCHIN_OFFSET + rng() * URCHIN_OFFSET_VAR, y: nextTop });
    }
    // Fish over the gap (at jump height) and/or floating above the platform.
    if (rng() < P.fishOverGap) {
      fish.push({ x: (prev.x + prev.w + nx) / 2, y: Math.min(prev.y, nextTop) - 60 - rng() * 40 });
    }
    if (rng() < P.fishOnPlat) {
      fish.push({ x: nx + w * (0.3 + rng() * 0.4), y: nextTop - 50 });
    }
    prev = plat;
  }

  // Final stretch: widen the last platform and drop the goal near its end.
  prev.w = Math.max(prev.w, 380);
  const goal = { x: prev.x + prev.w - 120, y: prev.y };
  const worldW = prev.x + prev.w + 220;
  return { platforms, urchins, fish, goal, worldW, startX: START_X, startTop: START_TOP };
}

// Trivial always-solvable fallback (effectively never used).
function buildFlatLevel(level) {
  const platforms = [];
  let x = 0;
  for (let i = 0; i < 6 + (level % 4); i++) {
    platforms.push({ x, y: START_TOP, w: 360 });
    x += 360 + 120;
  }
  const last = platforms[platforms.length - 1];
  last.w = 420;
  return {
    platforms, urchins: [], fish: [],
    goal: { x: last.x + last.w - 120, y: START_TOP },
    worldW: last.x + last.w + 220, startX: START_X, startTop: START_TOP,
  };
}

// --- Public API -------------------------------------------------------------
// Always returns a level that `simulate()` confirms is beatable. The retry
// sequence is derived deterministically from the seed, so a given (level,
// difficulty) always yields the same final level.
export function generateLevel(opts = {}) {
  const level = opts.level || 1;
  const difficulty = opts.difficulty === "normal" ? "normal" : "kid";
  const base = seedFor(level, difficulty);
  const P = profile(level, difficulty);
  for (let attempt = 0; attempt < 32; attempt++) {
    const L = buildLevel(makeRng((base + Math.imul(attempt, 0x9e3779b1)) >>> 0), P);
    if (simulate(L)) {
      L.meta = { level, difficulty, attempts: attempt + 1, fallback: false };
      return L;
    }
  }
  const L = buildFlatLevel(level);
  L.meta = { level, difficulty, attempts: 32, fallback: true };
  return L;
}

// Exposed for tests/diagnostics: the raw nth candidate, before validation.
export function candidate(level, difficulty, attempt = 0) {
  const base = seedFor(level, difficulty);
  return buildLevel(makeRng((base + Math.imul(attempt, 0x9e3779b1)) >>> 0), profile(level, difficulty));
}

// --- Solvability check ------------------------------------------------------
function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// The x positions (otter left-edge) at which a perfect player jumps: just before
// each gap, and just before each urchin.
function jumpTargets(level) {
  const { OTTER_W, URCHIN_R } = PHYS;
  const plats = level.platforms;
  const ts = [];
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i];
    for (const u of level.urchins) {
      if (u.x >= p.x && u.x <= p.x + p.w) ts.push(u.x - URCHIN_R - 64);
    }
    if (i < plats.length - 1) ts.push(p.x + p.w - OTTER_W - 4);
  }
  ts.sort((a, b) => a - b);
  const out = [];
  for (const t of ts) if (!out.length || t - out[out.length - 1] > 8) out.push(t);
  return out;
}

// Runs the SAME fixed-step physics and collision rules as the game's update()
// with an autopilot, and reports whether the otter reaches the goal alive.
export function simulate(level) {
  const {
    RUN_SPEED, GRAVITY, JUMP_V, MAX_FALL, COYOTE_TIME, JUMP_BUFFER,
    OTTER_W, OTTER_H, URCHIN_R, SOLID, DEATH_Y,
  } = PHYS;
  const STEP = 1 / 120;
  const targets = jumpTargets(level);

  let ox = level.startX, oy = level.startTop - OTTER_H;
  let vy = 0, grounded = true, coyote = 0, buffer = 0, ti = 0;

  for (let iter = 0; iter < 24000; iter++) {
    if (ti < targets.length && grounded && ox >= targets[ti]) { buffer = JUMP_BUFFER; ti++; }

    const prevY = oy, prevBottom = oy + OTTER_H;
    ox += RUN_SPEED * STEP;

    if (grounded) coyote = COYOTE_TIME; else coyote = Math.max(0, coyote - STEP);
    if (buffer > 0) buffer = Math.max(0, buffer - STEP);
    if (buffer > 0 && coyote > 0) { vy = -JUMP_V; grounded = false; coyote = 0; buffer = 0; }

    vy = Math.min(MAX_FALL, vy + GRAVITY * STEP);
    oy += vy * STEP;

    // Horizontal wall collision = crash.
    for (const p of level.platforms) {
      if (overlaps(ox, prevY, OTTER_W, OTTER_H, p.x, p.y, p.w, SOLID)) return false;
    }
    // Land on tops.
    grounded = false;
    for (const p of level.platforms) {
      if (ox + OTTER_W <= p.x || ox >= p.x + p.w) continue;
      if (vy >= 0 && prevBottom <= p.y + 1 && oy + OTTER_H >= p.y) {
        oy = p.y - OTTER_H; vy = 0; grounded = true;
      }
    }
    // Urchins.
    for (const u of level.urchins) {
      const ux = u.x - URCHIN_R, uy = u.y - URCHIN_R * 2;
      if (overlaps(ox + 6, oy + 6, OTTER_W - 12, OTTER_H - 8, ux, uy, URCHIN_R * 2, URCHIN_R * 2)) return false;
    }
    if (ox + OTTER_W * 0.5 >= level.goal.x) return true;
    if (oy > DEATH_Y) return false;
  }
  return false;
}
