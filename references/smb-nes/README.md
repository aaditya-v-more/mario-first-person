# Super Mario Bros. NES reference collection

This collection covers **Worlds 1–1 through 8–4**, including their underground, underwater and sky bonus areas. The playable campaign uses the original 32-course order. Its 3D course geometry is compiled from the original object order and coordinates, rather than assembled from repeated custom course sections.

## Sources

- [The Mushroom Kingdom: complete annotated NES map set](https://themushroomkingdom.net/maps/smb). All 32 PNG maps were collected and their SHA-256 hashes are recorded in [manifest.json](manifest.json). These include enemy positions, lift directions, pipe connections and the castle maze routes.
- [FullScreenMario map definitions](https://github.com/jaggedsoft/FullScreenMario/blob/1dfe618bfa966dcad6b91e91aa67649bb869b442/Source/settings/maps.js), originally authored by Joshua K. Goldberg and contributors, provide structured coordinates for 32 courses and 63 areas. The source is MIT licensed; its license is included here and in the game’s third-party notices. The import script parses literal data with TypeScript’s syntax parser and never executes the downloaded JavaScript.
- [NES Maps: labeled map index](https://www.nesmaps.com/maps/SuperMarioBrothers/SuperMarioBrothers.html) is an additional visual reference.

The image collection is kept in `work/smb-reference/` for local research. The downloadable archive and offline viewer are in `outputs/`. The website renders its own procedural geometry and miniature course diagrams; it does not embed the downloaded map images as game art.

## Audited corrections to the structured reference

The annotated maps take precedence where the structured reference has errors:

| Course | Correction |
| --- | --- |
| 3–1 | Timer is 400; the vine goes to location 4; the underground exit returns to location 1. |
| 4–4 | Timer is 400. Its upper/lower maze passages retain their return loops. |
| 5–1 | Timer is 300. |
| 5–2 | The vine goes to the sky area at location 4. |
| 7–1 | The underground exit returns to location 1. |
| 7–2 | The underwater exit leads to location 2. |
| 8–4 | The underwater exit leads to the final castle room at location 5. |
| 2–1 | The pipe at source coordinate 368 contains a Piranha Plant. |

Sky-area exit locations return the player to the source map’s specified position. The looping castle sections use the original NES screen width (128 reference units), not the current browser’s screen width. The source positions of the first block, pipes, Goomba and first pit in 1–1 are regression tested.

## First-person adaptation

The compiler initially converts a 16-pixel NES tile to 0.9 world units. `spatial-layout.ts` then scales the forward axis by 1.5 while retaining source vertical positions and encounter order. Outdoor areas span 12 units, indoor areas 14, and water areas 16. Terrain islands, blocks and athletic platforms use lateral routes; pipes have circular 2.4-unit footprints. Required ground pipes occupy narrow crossing supports with broad landings, and pits interrupt the full ground width. Outdoor edges are real cliffs rather than invisible walls. Firebars use radial arms, and enemies have round contact areas and lateral movement. The standing camera is 1.65 units high, with crouching and low-ceiling clearance for tunnels. These choices restore the spatial scale and appearance of commit `ffea6f3` rather than stretching the original map into a narrow corridor.

The adapter supports question blocks, hidden 1-ups, breakable and multi-coin bricks, power upgrades, vines, pipe rooms, swimming, springboards, moving and falling platforms, scales, castle route checks, and axe/bridge finishes. Enemy and platform behavior is an adaptation for this engine rather than a cycle-accurate NES emulation.

Warp pipes retain their destinations but obey the requested level locks: they cannot unlock or enter a future course. Only clearing the currently available course unlocks its successor. Replaying a completed course does not advance the unlock boundary.

The old custom campaign’s save is separate from this NES campaign. A fresh NES save starts with only World 1–1 available. Unlocks are local to this browser/device.

## Reproduce the collection

```sh
npm run collect:maps
npm run import:maps
```

The first command downloads the PNGs and pinned source. The second regenerates `app/game/reference/smb-nes.json` and the manifest. `app/game/smb-levels.ts` performs the 3D adaptation and documented corrections. No ROM or original executable is required.
