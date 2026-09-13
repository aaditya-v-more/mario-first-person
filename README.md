# Mario - First Person

A first-person 3D browser platformer with procedural geometry and sounds, keyboard and touch controls, and a standalone HTML build.

[Play Mario in your browser](https://mario-first-person.vercel.app/)

## Layout

```text
app/game/       Game UI, 3D world, physics, audio and controls
app/            Page, layout and styles
components/ui/  Bundled UI components
public/         Standalone mario.html and favicon
scripts/        Standalone HTML exporter
tests/          Physics and gameplay tests
.openai/        Original Sites hosting metadata
vercel.json     Vercel static deployment configuration
```

## Play

Open `public/mario.html` directly in a modern browser. It contains the game, Three.js, UI, and styles in one file; no CDN or server is needed. WebGL/hardware acceleration is required.

- WASD: move. Mouse: look. Space: jump. Shift: sprint.
- Escape or P: pause. Arrow keys: forward/back and turning if pointer lock is unavailable. Dragging also controls the camera.
- On touch devices, use the left joystick, drag the world to look, and tap Jump.
- The **RTX** switch in the top toolbar enables enhanced lighting, environment reflections, contact shadows, bloom, and antialiasing. It starts **off** on every page load; turning it off restores the original graphics. Pause with Escape to change it while using mouse look. Switching preserves the current course, position, coins, timer, and audio settings.
- Collect coins, hit question blocks from below, stomp Goombas, and reach the flag. There are three lives, a checkpoint, and a three-minute timer.

RTX is the name of an optional Three.js graphics preset, not NVIDIA hardware ray tracing. It uses [GTAO](https://threejs.org/docs/pages/GTAOPass.html), [bloom](https://threejs.org/docs/pages/UnrealBloomPass.html), and a locally generated HDR sky. Reflections use a snapshot of the surrounding course captured when the mode is enabled. It needs floating-point render targets and costs more GPU time than classic mode; unsupported devices keep classic graphics. Effects load only when enabled, release their GPU resources when disabled, and cap rendering at two million pixels with half-resolution ambient occlusion. The standalone HTML still works offline.

The preset uses WebGL 2 on Apple Silicon Macs (including M5) and Windows laptops with NVIDIA, AMD, or Intel GPUs. There is no NVIDIA-only API or WebGPU requirement. Support is checked using the browser's floating-point framebuffer and shader compilation; if either fails, the toggle stays off and the existing game remains playable. Use a current browser with hardware acceleration enabled.

## Development

`npm ci` then `npm run dev`. `npm test` runs deterministic physics, game-state, and graphics-state tests. `npx tsc --noEmit` checks types. `npm run build` exports the standalone HTML and builds the hosted game. `npm run export:html` only refreshes the HTML. For graphics integration tests, install browsers with `npx playwright install chromium webkit`, then run `npm run test:graphics`.

## Vercel

`npm run build:vercel` builds the same standalone game into `vercel-dist/index.html`. The checked-in `vercel.json` configures installation, build, and output, so importing this repository into Vercel needs no environment variables. Both `/` and `/mario.html` serve the game. The original Sites build and [hosted version](https://mario-first-person-adventure.nolongerhuman4156.chatgpt.site) remain available.

All world geometry and game sounds are created procedurally. The source is in `app/game/`; the HTML exporter is in `scripts/`.

## Validation

The 15 unit tests cover gameplay plus graphics restoration, resource disposal, cancellation, unsupported-device fallback, and the resolution budget. Graphics integration tests run the standalone HTML in Chromium and WebKit, covering toggling, restoring the original rendered pixels, preserving progress, keyboard access, resizing, restarting, and GPU texture cleanup. Both browser suites passed on an Apple M5 with hardware rendering. Windows/NVIDIA hardware has not been directly tested; it uses the same capability-checked WebGL 2 renderer. Optional WebMCP actions are feature-detected; they have not been verified in a browser with a supported WebMCP context.


## Phone controls and fullscreen

The game fits portrait, landscape and short screens, including safe-area insets.
Start and pause menus scroll when needed; the left joystick moves, dragging the
world looks around, and the right button jumps. Cancelling a touch releases the
joystick. Desktop keyboard/mouse controls and optional RTX remain available.

Starting or resuming from a game button requests fullscreen when supported.
If the browser declines, play continues in the tab. Leaving fullscreen disables
automatic entry for this page session; use the toolbar button to enter again.
Creator links stay inside the start, pause and end menus.

Run `npm test`, `npm run test:fullscreen`, `npm run test:mobile` and
`npm run test:graphics` to check gameplay, fullscreen behavior, phone layouts and
graphics. Build the standalone Vercel export with `npm run build:vercel`.

The Git-linked Vercel project `mario-first-person` publishes successful pushes to `main`. The canonical game address is `https://play.aadityamore.com/mario/`; Play forwards that path to the live independent deployment. The source owns the canonical metadata, menu-only Back to Play link and `THIRD_PARTY_LICENSES.txt`. Keep asset URLs relative so both the standalone root and forwarded Play path work. Verify the pushed commit reaches production; no additional manual game deployment or portfolio copy is needed.
