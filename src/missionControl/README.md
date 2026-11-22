# Mission Control (Drago) — our changes on top of God's Eye v0.3.0

Spec: D.R.A.G.O §8.6 (Field Ops) and §8.7 (Mission Control design language).
Rule: our code lives in this folder; upstream files get the smallest possible
edits, each marked with a "Mission Control" comment.

## Changes
1. Home city first — home.js; upstream edit: src/app/controls.js
2. Dark grey default map (Esri Dark Gray Canvas; CARTO now needs a key) — darkMap.js
   upstream edits: maps/catalog.js, maps/defaultSources.js, app/scene.js,
   mapStackChips.js, view/index.js, share/viewCodec.js (appended, never
   reordered), layers/submarineCables/policy.js
   Fallback: dark tiles fail → Esri Satellite.
3. Mission Control frame + dark blue/purple theme — shell.js, theme.css
   (layout from the Mission Control mockup). Upstream edits: style.css (one
   @import, last), src/main.js (one import), src/app/controls.js
   (attachMissionControl). Top bar: brand · GLOBE/CITY/MAP · VIEW/TOOLS ·
   place/time/LIVE. Left: Mission Brief + data layers. Right: Drago, Focus
   (real camera numbers only), Signals. Bottom: Drago command bar (disabled
   until Mark 1). Hidden: God's Eye title, fake intel HUD, first-run
   launcher, share/clear buttons, Cesium ion logo (no ion services used
   without a token; data attributions stay visible).
4. CARTO key support — CARTO_API_KEY in .env → Dark Matter; else Esri dark.
   Upstream edits: build/vite.js, server/standalone/vite.config.js.
5. Data Layers / Scenes no longer overlap the Mission Brief — #mc-brief added
   to upstream's left-rail obstacle list, so their layout code pushes the
   stack below it. Upstream edit: src/ui/panelLayoutController.js (one line).

## Upstream tests that now fail ON PURPOSE (they encode upstream defaults)
- src/mapStackChips.test.mjs — expects the 5 upstream sources (we add "dark")
- src/share/viewCodec.test.mjs — "defaults ... match today's app defaults"
- src/maps/controller.test.mjs — 6 imagery-comparison tests assume the
  default stack is photoreal / esri-imagery
Re-check these when moving to a new upstream release.
