# Mario - First Person

A complete first-person platforming campaign with 24 courses across six worlds, procedural 3D art and music, keyboard and touch controls, and an offline standalone HTML build.

[Play Mario in your browser](https://mario-first-person.vercel.app/)

## Layout

```text
app/game/       Campaign data, game UI, world, physics, audio, saves and controls
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

- WASD: move. Mouse: look. Hold Space for a full jump; release early for a shorter hop. Shift: sprint. F or a mouse click while looking: throw fireballs after collecting a fire flower.
- Escape or P: pause. Arrow keys: forward/back and turning if pointer lock is unavailable. Dragging also controls the camera.
- On touch devices, use the left joystick, drag the world to look, hold Jump for height, and hold Run for longer gaps. A Fire button appears when you have a fire flower.
- The **RTX** switch in the top toolbar enables enhanced lighting, environment reflections, contact shadows, bloom, and antialiasing. It starts **off** on every page load; turning it off restores the original graphics. Pause with Escape to change it while using mouse look. Switching preserves the current course, position, coins, timer, and audio settings.
- Hit question blocks from below, collect their power-ups, stomp Goombas, and stomp Koopas twice. Mushrooms absorb a hit; fire flowers add bouncing fireballs; Super Stars provide 12 seconds of invincibility. Falling still costs a life.
- Every 50 coins awards a life. Clearing a course awards a life, a time bonus, and access to the next course. Lives, power and adventure score carry into the next course.
- Four marked checkpoints per course preserve your collected items after a fall. Restarting a course rolls its score and coin earnings back, preventing repeat collection from inflating your adventure score.
- The level map shows unlocked courses, collected star coins, medals, high scores and best times. Completion saves locally on this device; the Continue button starts the latest unlocked course. In-progress checkpoint positions are not saved across page reloads.

## Campaign

The campaign has **24 courses, 192 linked stages, 96 checkpoints, 72 star coins, six Bowser encounters, and 72 challenge medals**. Courses combine eight authored stage layouts into four acts. Mirrored routes, branching islands, vertical climbs, ferries, elevators, pipe passages, firebars and enemy arrangements change the route and timing. Later boss encounters add spread shots.

| World | Courses |
| --- | --- |
| Mushroom Kingdom | Mushroom Meadows; The Long Way Up; River of Islands; The Garden Gate |
| Crystal Underground | Into the Pipeworks; Crystal Ascent; The Lost Aqueduct; Furnace Below |
| Cloudtop Islands | Above the Clouds; Stairway to the Sun; Skybound Express; Thunderhead Fortress |
| Ember Archipelago | Ember Crossing; Molten Switchbacks; Foundry on Fire; The Inferno Gate |
| Moonlit Citadel | Moonlit Battlements; The Winding Keep; Siege of the Stars; The Midnight Guard |
| Bowser’s Domain | Road to the Throne; The Last Ascent; Castle of No Return; Bowser’s Last Stand |

Each course has three optional star coins plus medals for collecting at least 80% of its regular coins, beating its target time, and finishing without damage. Star-coin discoveries merge across successful replays. Levels remain replayable after the final victory.

The design target is a multi-hour first playthrough, with additional completionist play. This is a content/pacing target, **not a measured completion-time guarantee**: speed, retries, exploration and replay goals substantially change play time. The automated suites do not substitute for a timed human campaign playtest.

## Built for 3D

Walkable terrain is made of separate islands, full-width hurdles and enclosed passages. Gaps have no ground alongside or underneath them. Interior walls and boss gates extend beyond the reachable jump height, and distant scenery is outside jumping range. Alternate branches are intentional routes that reconnect; they do not erase the required gaps.

Physics substeps prevent fast movement from tunnelling through thin walls. Landing resolution chooses the highest crossed surface. Moving platforms carry grounded players and freeze on pause. Enemies respect ledges, pipes and elevated floors. Checkpoints and finishes check position in three dimensions. A landing shadow, coin trails, act markers, jump buffering and a short ledge grace period make first-person platforming easier to read.

RTX is the name of an optional Three.js graphics preset, not NVIDIA hardware ray tracing. It uses [GTAO](https://threejs.org/docs/pages/GTAOPass.html), [bloom](https://threejs.org/docs/pages/UnrealBloomPass.html), and a locally generated HDR sky. Reflections use a snapshot of the surrounding course captured when the mode is enabled. It needs floating-point render targets and costs more GPU time than classic mode; unsupported devices keep classic graphics. Effects load only when enabled, release their GPU resources when disabled, and cap rendering at two million pixels with half-resolution ambient occlusion. The standalone HTML still works offline.

The preset uses WebGL 2 on Apple Silicon Macs (including M5) and Windows laptops with NVIDIA, AMD, or Intel GPUs. There is no NVIDIA-only API or WebGPU requirement. Support is checked using the browser's floating-point framebuffer and shader compilation; if either fails, the toggle stays off and the existing game remains playable. Use a current browser with hardware acceleration enabled.

## Development

`npm ci` then `npm run dev`. Available checks:

- `npm test`: 31 deterministic physics, campaign, power-up, save and graphics-state tests.
- `npx tsc --noEmit`: TypeScript checks.
- `npm run test:campaign`: Chromium/WebKit rendering of all 24 courses, transitions, boss victory, graphics preservation, resource cleanup, keyboard menus, saved unlocks and touch layout.
- `npm run test:graphics`: Chromium/WebKit RTX support, restoration, resize, input and GPU resource tests.
- `npm run test:plethora`: Plethora adapter lifecycle checks.
- `npm run build`: refresh the standalone HTML and build the hosted application.
- `npm run build:vercel`: refresh the standalone HTML and create the static deployment output.

Install integration-test browsers with `npx playwright install chromium webkit`. `npm run export:html` refreshes only the standalone HTML. `tests/browser-harness.ts` is a test-only entry point and is never included in a shipping build.

## Vercel

`npm run build:vercel` builds the same standalone game into `vercel-dist/index.html`. The checked-in `vercel.json` configures installation, build, and output, so importing this repository into Vercel needs no environment variables. Both `/` and `/mario.html` serve the game. The original Sites build and [hosted version](https://mario-first-person-adventure.nolongerhuman4156.chatgpt.site) remain available.

All world geometry and game sounds are created procedurally. The source is in `app/game/`; the HTML exporter is in `scripts/`.

## Validation

The campaign and graphics browser suites passed in Chromium and WebKit on an Apple M5 with hardware rendering. All 24 courses render without browser or WebGL errors, and repeated restarts release their level resources. Unit tests verify terrain reachability within the jump envelope, safe checkpoint support, collectible reach, edge-bypass prevention, elevated stomps, moving-platform transport, collision substeps, boss gates, progression and malformed-save handling.

The changed game and campaign files pass the targeted lint check. The repository-wide `npm run lint` still reports pre-existing findings in bundled `components/ui`, `hooks/use-mobile.ts`, and the graphics test instrumentation.

Terrain reachability checks are a geometric check, not a proof of every real-time hazard sequence. A complete timed human playthrough and testing on physical phones or Windows/NVIDIA hardware remain useful validation. Touch controls have been exercised in browser mobile emulation. Optional WebMCP actions are feature-detected and retain normal visible controls.
## Plethora

`npm run build:plethora` creates `outputs/plethora/main.js`, `plethora.json`, and the API upload body `draft.json`. The adapter in `plethora/` reuses the full campaign and engine, loads the approved `three@0.164.1` through Plethora's registry, and uses the host's canvas, event listeners, frame loop, lifecycle, and music. It includes touch movement, drag-to-look, Jump, Run and Fire buttons, course transitions, keyboard controls, safe-area spacing, pause, instructions, and replay. This version uses classic graphics; the website retains its RTX option.

`npm run test:plethora` checks the adapter lifecycle, first-user-gesture start, pause/replay, cleanup, and loading failures with a simulated host and renderer. These checks do not replace a playtest in Plethora's native WebView.

Before uploading, recheck the current [creator contract](https://api.plethora.studio/v1/agent/context.md), SDK, schema, and library registry. This adapter was prepared against context `plethora-agent-context-2026-08-13.1`.

1. Run `node scripts/plethora-upload.mjs pair`, then approve its code at the returned approval URL or in the Plethora app.
2. Run `node scripts/plethora-upload.mjs exchange` after approval. A pending result can be checked again; an approved exchange must not be repeated.
3. Run `node scripts/plethora-upload.mjs upload` to upload the built draft.
4. Open the draft in Plethora, playtest on your phone, and publish manually.

The helper saves pairing and access credentials in ignored `.env.plethora-*.json` files with owner-only permissions. Do not share or commit these files. Reuse the approved token for later uploads until it expires or is revoked. The draft upload does not publish the game.


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
