# Mario — First Person

A first-person reconstruction of **Super Mario Bros. (NES): all 32 courses from World 1–1 through 8–4**, including 63 main and bonus areas.

[Play Mario](https://play.aadityamore.com/mario/)

## Courses and progression

The start screen displays all 32 courses in eight world groups. A fresh save enables only 1–1. Clearing a course unlocks exactly its successor. Completed courses remain replayable; starting, restarting, dying, or revisiting a course never unlocks another one. Progress saves on this browser/device.

The former custom campaign has a separate save key, so its completions do not unlock these newly reconstructed NES courses. There is no account or cross-device synchronization.

The reference maps supply the sequence of terrain, blocks, pipes and enemies, plus bonus rooms, vines, underwater routes, moving platforms, castle loops, and axe/bridge finishes. The 3D interpretation restores the broad checkerboard islands, tall first-person camera, cubic blocks and round pipes of commit `ffea6f3`. Platforms and routes spread sideways across the world. Required ground-pipe crossings have narrow supports between wide landings; gaps extend across the available ground, so simply walking around an obstacle leads off the island. Outdoor courses have no invisible side walls. This is an adaptation, not a cycle-accurate emulator.

See [the reference collection](references/smb-nes/README.md) for all map links, checksums, pinned source revision, licensing, coordinate conversion, and audited corrections. The campaign uses original course lengths rather than repeated sections added to extend playing time.

## Play

Open `public/mario.html` directly in a modern browser, or run a local server. The HTML includes the game, Three.js, UI and styles and works offline. Hardware-accelerated WebGL is required.

- **WASD:** move. **Mouse/drag:** look. Arrow keys also move and turn.
- **Space / Jump:** hold for a full jump, release for a shorter hop. Hold it underwater to swim upward.
- **Shift / Run:** sprint. **C / Duck:** crouch when needed.
- **E / Enter:** use a pipe or a revealed vine. Horizontal exit pipes trigger on approach.
- **F / Fire / click while using mouse look:** throw fireballs after collecting a fire flower.
- **Escape or P:** pause.

Touch controls support simultaneous movement, looking, jumping, running, pipe entry and fire. Menus scroll on short screens and respect safe-area insets. Touch buttons remain available after a browser switches between touch and mouse input.

Ground enemies start in staggered lanes, patrol diagonally and pursue nearby players across the terrain. They respect walls, cliffs and a local patrol boundary; stomping remains the main way past them.

Question blocks contain coins and upgrades. Hidden blocks reveal secrets; multi-coin bricks have a finite supply. Super Mario can break ordinary bricks. A mushroom absorbs a hit, a fire flower grants fireballs, and a Super Star briefly protects against enemies and fire. Falling and lava remain dangerous. Every 100 coins awards a life.

The castle courses require the original route choices or pipe sequence. Reach the axe to collapse Bowser’s bridge, or defeat him with fireballs and continue to the rescue room. Warp pipes retain their destinations but respect the requested progression locks; they cannot open a future course.

Midpoint checkpoints on suitable outdoor courses preserve collected items after a fall. Castles remain single-run challenges. Restarting rolls the current course’s earnings back; in-progress checkpoint positions are not persisted across reloads.

## Graphics

Classic rendering uses world-space lawn variation, shaded undersides, soft rim highlights, embossed brickwork and clear-coated pipes. These lightweight material shaders retain the original palette and work without enabling RTX.

The **RTX** switch is an optional Three.js lighting preset, not hardware ray tracing. It adds ambient occlusion, reflections, bloom and antialiasing. It starts off, preserves game progress, and falls back to classic graphics when unsupported. Effects respect the active area’s palette, including underwater and underground rooms.

The preset uses WebGL 2, floating-point targets, a two-million-pixel rendering budget and half-resolution ambient occlusion. Effects and GPU resources are released when disabled. Static terrain is instanced to reduce the cost of the many original brick tiles; breakable blocks and collapsing bridges keep their own visibility handles.

## Project layout

```text
app/game/smb-levels.ts       Reference-to-3D course compiler and corrections
app/game/spatial-layout.ts   Wide terrain, lateral routes and 3D obstacle placement
app/game/level-types.ts      Course, area, portal and terrain types
app/game/reference/          Parsed, pinned map data
app/game/CourseAtlas.tsx     All 32 course cards and miniature map diagrams
app/game/                   Engine, world, physics, UI, audio and save handling
references/smb-nes/          Map manifest, credits and adaptation notes
public/                     Offline game, favicon and third-party notices
scripts/                    Reference collection and build/export utilities
tests/                      Physics, progression, fullscreen and browser checks
plethora/                   Adapter for the managed Plethora runtime
```

## Development and validation

`npm ci`, then `npm run dev`.

- `npm test`: deterministic physics, source-layout, area connectivity, power-up, maze, progression, save and graphics-state tests.
- `npm run test:pointer`: mouse capture gesture ordering, focus, escape, retry, legacy API and hybrid touch behavior with emulated browser grants.
- `npm run test:fullscreen`: five fullscreen lifecycle and fallback tests.
- `npm run test:campaign`: render every course and all 63 areas in Chromium/WebKit; verify safe entries, completion, graphics restoration, cleanup, all 32 visible course cards, locked-state persistence, and phone layouts.
- `npm run test:mobile`: portrait/landscape layouts, touch cancellation, creator links and denied-fullscreen recovery.
- `npm run test:graphics`: Chromium/WebKit effects, exact classic rendering restoration, progress preservation, resizing and resource cleanup.
- `npm run test:plethora`: managed-host lifecycle, replay, cleanup and loading failures.
- `npx tsc --noEmit`: type checking.
- `npm run build`: offline export and hosted application build.
- `npm run build:vercel`: offline export and static deployment output.

Install browser test engines with `npx playwright install chromium webkit`. The browser harness is test-only and is not included in the game. Browser suites use Apple M5 hardware rendering and mobile emulation; they do not constitute a full manual playthrough or physical-phone certification.

The changed game files pass targeted lint. Repository-wide lint still includes existing findings in unrelated bundled UI files and older graphics-test instrumentation.

## Collect the reference maps

`npm run collect:maps` downloads the 32 annotated PNG maps and pinned MIT-licensed layout reference to `work/smb-reference/`. `npm run import:maps` parses the literal data and regenerates its manifest. Downloaded JavaScript is never executed, and no ROM is required.

The collected archive and an offline map viewer are available locally in `outputs/smb-nes-reference-maps.zip` and `outputs/smb-nes-reference-atlas.html`. Map images are research references, not embedded game art. Source attribution and the layout-data license are retained in `public/THIRD_PARTY_LICENSES.txt`.

## Phone controls and fullscreen

The game fits portrait, landscape and short screens, including safe-area insets. Start, course-selection and pause menus scroll when needed. Desktop keyboard/mouse controls and optional RTX remain available.

Starting or resuming with a mouse or keyboard focuses the canvas and requests native mouse capture immediately, before requesting fullscreen. Escape releases capture and pauses; Resume requests it again. Touch gestures keep drag-to-look controls. If a browser refuses capture, clicking the game retries and drag/arrow-key look remains available.

Starting or resuming from a game button requests fullscreen when supported. If the browser declines, play continues in the tab. Leaving fullscreen disables automatic entry for this page session; use the toolbar button to enter again. Creator links and Back to Play remain inside menus and never overlay active play.

## Vercel

The Git-linked Vercel project `mario-first-person` publishes successful pushes to `main` using `vercel.json`. The canonical game address is `https://play.aadityamore.com/mario/`; Play forwards that path to the live independent deployment. The source owns canonical metadata, the menu-only Back to Play link, and `THIRD_PARTY_LICENSES.txt`.

`npm run build:vercel` creates `vercel-dist/index.html`, `/mario.html`, the favicon and license notices. Asset URLs remain relative so the standalone root and forwarded Play path both work. Verify the exact pushed commit reaches production; no manual portfolio copy is needed.

## Plethora

`npm run build:plethora` creates `outputs/plethora/main.js`, `plethora.json`, and the draft API upload body. The adapter reuses the game engine and all 32 courses, loads `three@0.164.1` through the host registry, and uses the host canvas, events, frame loop, lifecycle and music. It provides Jump/Swim, Run, Fire, Enter and Duck controls. This version uses classic graphics.

`npm run test:plethora` checks the simulated managed-host lifecycle. Native WebView playtesting is still required before publishing there. Before uploading, recheck the current creator contract, SDK, schema and registry at `https://api.plethora.studio/v1/agent/context.md`.

The existing helper supports `node scripts/plethora-upload.mjs pair`, `exchange`, and `upload`. It stores pairing and access credentials in ignored `.env.plethora-*.json` files with owner-only permissions. Draft upload does not publish the game; keep those credential files private.
