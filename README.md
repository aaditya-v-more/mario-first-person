# Mario - First Person

An original implementation of a first-person 3D browser platformer. No existing game source or assets from the parent workspace were used.

[Play the hosted game](https://mario-first-person-adventure.nolongerhuman4156.chatgpt.site)

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

`npm run build:vercel` builds the same standalone game into `vercel-dist/index.html`. The checked-in `vercel.json` configures installation, build, and output, so importing this repository into Vercel needs no environment variables. Both `/` and `/mario.html` serve the game. The original Sites build and hosted link remain available.

All world geometry and game sounds are created procedurally. The source is in `app/game/`; the HTML exporter is in `scripts/`.

## Validation

Physics and game-state tests cover collisions, jump reach, coin/block collection, stomping, damage, checkpoint respawn, time-out, course completion, and restart. Browser interaction testing has not been performed. Optional WebMCP actions are feature-detected; they have not been verified in a browser with a supported WebMCP context.
