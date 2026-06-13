# 🦦 Otter Jump

A tiny Mario-style **auto-runner** built with plain HTML5 Canvas + vanilla JavaScript — no build step, no dependencies, one file.

The otter runs forward on its own. Your only job is to **jump**: time it to clear gaps and grumpy sea-urchins, scoop up fish along the way, and reach the otter's prized **shiny rock** at the finish.

## Play

The game loads code as ES modules, so it needs to be **served over http** (not
opened via `file://`). From the project folder:

```sh
python3 -m http.server 4321   # then visit http://localhost:4321/index.html
```

That URL also works for testing on a phone over your LAN, and is exactly how the
deployed GitHub Pages version runs.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Jump | **Space** / **↑** / **W** / click | **Tap** the screen |
| Higher jump | **hold** the jump key/tap | hold |
| Mute / unmute | **M** | — |

The otter moves automatically — you never steer, you only jump. Holding the
button jumps higher (variable jump height).

## Goal

- Reach the **shiny rock** on its pedestal at the end of the course to win.
- Grab **fish** scattered along the way for a higher score. They're optional —
  many float over gaps to reward bigger jumps. Your best catch is saved locally.
- Avoid **sea-urchins** and don't fall in the **water** — either is a splash.

## How it's built

- [`index.html`](index.html) — the game: a **fixed-timestep loop** (120 Hz
  physics) with forgiving jump mechanics (coyote-time, jump-buffering, variable
  jump height), a **portrait-first world camera** that fills any screen with
  iOS safe-area support, and **no asset files** (the otter, fish, urchins, rock,
  parallax scenery, and WebAudio sound effects are all generated in code).
- [`js/levelgen.js`](js/levelgen.js) — the **procedural level generator**, shared
  by the game and the tests. Levels are seeded by (level number, difficulty) so
  they're reproducible, and every gap is placed within the otter's verified jump
  reach. Each generated level is additionally validated by a faithful physics
  `simulate()` so it's **guaranteed beatable**.

## Tests

```sh
npm test   # generates 600 levels across difficulties and asserts each is solvable
```
