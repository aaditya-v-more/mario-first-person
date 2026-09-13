# Game source guidance

This is an independently maintained project. Any modification to this project or its deployment requires explicit user approval for the affected project and the specific change. A general request to maintain or synchronize the portfolio, Play hub or Learn hub does not authorize changes here, including links, content, layout, behavior, themes, documentation or hosting. Approval already given for a specific change remains valid; do not ask again for that same work. The requirements below guide authorized work and do not grant permission to make additional changes.

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

- Keep this game’s original palette. Synchronization refers only to creator/source navigation links, and adding or updating those links across projects requires explicit user permission. It does not authorize adding themes, using device appearance, or synchronizing appearance across sites. Preserve the existing authorized creator links.
