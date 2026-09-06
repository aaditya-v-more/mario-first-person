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
- Collect coins, hit question blocks from below, stomp Goombas, and reach the flag. There are three lives, a checkpoint, and a three-minute timer.

## Development

`npm ci` then `npm run dev`. `npm test` runs deterministic physics and game-state tests. `npx tsc --noEmit` checks types. `npm run build` exports the standalone HTML and builds the hosted game. `npm run export:html` only refreshes the HTML.

## Vercel

`npm run build:vercel` builds the same standalone game into `vercel-dist/index.html`. The checked-in `vercel.json` configures installation, build, and output, so importing this repository into Vercel needs no environment variables. Both `/` and `/mario.html` serve the game. The original Sites build and [hosted version](https://mario-first-person-adventure.nolongerhuman4156.chatgpt.site) remain available.

All world geometry and game sounds are created procedurally. The source is in `app/game/`; the HTML exporter is in `scripts/`.

## Validation

All 10 physics and game-state tests pass, covering collisions, jump reach, coin/block collection, stomping, damage, checkpoint respawn, time-out, course completion, and restart. TypeScript checking and the Vercel production build pass. The public game was checked in Chrome on 7 September 2026 for starting, movement, jump input, pause, resume, and restart, plus mobile layout and touch controls. Optional WebMCP actions are feature-detected; they have not been verified in a browser with a supported WebMCP context.
