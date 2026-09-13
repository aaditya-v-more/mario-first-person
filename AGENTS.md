# Game source guidance

- Preserve the phone portrait, landscape and short-screen layouts. Menus must
  remain scrollable, HUD and touch controls must fit the visible viewport, and
  controls must respect safe-area insets and support simultaneous move/look/jump.
- Request fullscreen only during explicit Start, Resume, Restart or fullscreen
  button gestures. Preserve ordinary in-tab play when unsupported or denied;
  respect browser/user exits without automatically re-entering. On desktop,
  request pointer lock before fullscreen consumes transient user activation.
- Keep the creator links inside start and pause/end menus, marked with
  `data-creator-links`: Website `https://aadityamore.com/`, GitHub
  `https://github.com/aaditya-v-more`, LinkedIn
  `https://www.linkedin.com/in/aadityavmore/`. Do not overlay active play.
- Preserve keyboard/mouse controls, optional RTX, gameplay and accessibility.
  Run gameplay, fullscreen and mobile browser tests plus `npm run build:vercel` before sharing
  a new standalone export. Keep dependencies and the lockfile unchanged unless
  the change requires them. Do not include unrelated work in a source commit.

- Keep sun/moon controls in start and pause/end menus. Follow device appearance until a manual choice is made; share the parent-domain appearance cookie on aadityamore.com and its subdomains. The bundled `public/appearance.js` is synchronized with the portfolio runtime. Theme interface panels and controls without changing rendered scenery, gameplay colors, progress or fullscreen state.
