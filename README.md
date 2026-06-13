# 🦦 Otter Jump

A tiny Mario-style **auto-runner** built with plain HTML5 Canvas + vanilla JavaScript — no build step, no dependencies, one file.

The otter runs forward on its own. Your only job is to **jump**: time it to clear gaps and grumpy sea-urchins, scoop up fish along the way, and reach the otter's prized **shiny rock** at the finish.

## Play

Just open `index.html` in any modern browser:

```sh
open index.html        # macOS
# or serve it (nicer for mobile testing on your LAN):
python3 -m http.server 4321   # then visit http://localhost:4321/index.html
```

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
- Grab **fish** (×17) for a higher score. They're optional — many float over
  gaps to reward bigger jumps. Your best catch is saved locally.
- Avoid **sea-urchins** and don't fall in the **water** — either is a splash.

## How it's built

Everything lives in [`index.html`](index.html):

- **Fixed-timestep loop** (120 Hz physics, rendered via `requestAnimationFrame`)
  for consistent "game feel" regardless of refresh rate.
- **Forgiving jump mechanics:** coyote-time (jump just after leaving a ledge),
  jump-buffering (press just before landing), and variable jump height.
- **Hand-tuned level** of platforms, gaps, urchins, fish, and the goal — designed
  so every gap is clearable with a single well-timed jump.
- **No assets:** the otter, fish, urchins, rock, parallax scenery, and all sound
  effects (WebAudio) are drawn/synthesized procedurally in code.
- **Responsive:** renders at a logical 1280×720 and letterboxes to fit any
  screen, with high-DPI support and touch handling for mobile.
