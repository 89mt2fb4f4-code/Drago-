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

6. Arwes accents — REMOVED in the restyle (item 11). Frames, grid, arwes.js
   and the packages (@arwes/frames, @arwes/bgs, motion) are gone;
   package.json/package-lock.json are back to upstream's dependency list.

7. Missing map tiles (HTTP 404) count as empty, not as an outage. Fixes a
   false "VECTOR TILES UNAVAILABLE (HTTP 404) ALPR CAMERAS" warning over
   Buffalo: the Canadian ALPR extract has no tiles south of the border.
   The tile index (.json) 404 is still an error. Shared by ALPR, TomTom
   traffic and OpenFreeMap. Upstream edit: src/sources/vectorTiles.js.
8. Street Level: Mapillary coverage lines + cones in a dim palette blue
   #2f4a85 instead of neon Mapillary green. Upstream edit: src/layers/streetLevel/policy.js.
9. Trimmed options (theme.css/shell.js only): no + grid, no CRT preset (and a
   scene switching to it goes back to Normal), no Scope, no scene safe-frame
   grid; END SCENE in the top bar while a scene plays.
10. CCTV split into STILL IMAGES / LIVE VIDEO tabs — cctvSplit.js. Dropdown,
   PREV/NEXT/NEAREST stay within the chosen kind. Upstream edit:
   src/layers/cctv/navigation.js (AUTO HOP + nearest-camera skip the other
   kind, read from <html data-mc-cctv-kind>).

11. Restyle v2 (purple reference + design skills) — theme.css "RESTYLE v2"
   block, darkMap.js, shell.js. Purple glass panels (translucent, blurred,
   no outlines or frames), title bars with a violet marker + fading rule,
   pill controls, press feedback, reduced-motion/-transparency/contrast.
   Map: CARTO tiles recoloured as they load (darkMap.js) — water black,
   land/buildings dark slate grey, roads dim purple, borders and place
   names purple→lavender. Globe ground-atmosphere haze off (shell.js) so
   oceans stay black. Map credits unchanged.

12. Overhaul — theme.css "OVERHAUL" block, mapToggle.js. Pill layer switches
   and glass panel buttons; status chips (*-sync-chip) as quiet pills; no
   "POWER UP · N KEYS WAITING" nag (#key-setup-chip; keys live in .env);
   layers button in the map-button column (now opens Visual Presets, see
   13). VIEW keeps Drago + a compact Focus and
   upstream stacks the VIEW cards below them. Upstream edit:
   src/ui/panelLayoutController.js ('#mc-right' in the right-rail obstacles).
13. Sci-fi layout (Pinterest refs: CCTV dashboard, EASYV, Ace Combat,
   water-plant) — shell.js, hudFrame.js, cctvCard.js, icons.js, darkMap.js,
   theme.css "SCI-FI LAYOUT" + "ROUND 3" blocks:
   • top bar: notched HUD plate with title + GLOBE/CITY/MAP, VIEW/TOOLS as
     wings, END SCENE under it; CLEAN UI chip (presses upstream's Clean UI,
     hides every panel; top bar + credits stay)
   • full-screen HUD outline; screen edges/corners darkened
   • panels fully transparent (no boxes), angled gradient title tabs
   • clean line icons replace upstream's colourful emoji (data-icon, pp-icon)
   • Visual Presets dock tray and language picker hidden. Visual Presets
     now open from the bottom-right layers button (mapToggle.js): our own
     panel beside the button column, holding upstream's look buttons
     (#style-buttons, line icons) and MAP SOURCE chips, moved there so
     upstream's handlers and 1-7 keys still work. Esc, × or a click
     outside closes it. Picking a look still opens upstream's DISPLAY panel
     with that look's settings (upstream behaviour)
   • CCTV: the side panel is the normal view (wider, calibration/projection/
     summary hidden; PREV/NEXT stay there). FULL SCREEN — button on the small
     screen, or click a camera on the map — opens a big centred card over a
     darkened map. Upstream's ground projection and view-cone (COVERAGE) are
     switched off (the COVERAGE button can turn the cone back on). Card is as
     big as the screen allows (16:9 feed fits vertically); Esc, × or a click
     on the dimmed map closes it (Esc is caught before upstream eats it)
   • Data Layers always visible (it can still collapse with +/–). Upstream's
     one-letter shortcuts (F hides layers, C, V, 1-7…) ignore modifier keys,
     so ⌘⌃F (Mac full screen) used to hide Data Layers — shell.js now stops
     ⌘/Ctrl/Alt + letter before upstream sees it
   • Data Layers category switches — categoryToggle.js. Each heading
     (Movement, Cameras…) gets a switch: any layer on → click turns the whole
     category off; all off → click turns it all on. It presses upstream's own
     row buttons (staggered 120 ms), so no upstream file changes
   • Focus panel can't freeze the map: while the map morphs globe ↔ flat MAP
     the camera has no heading for a moment; the Focus updater threw, and
     an error inside Cesium's draw loop stops drawing for good (map stuck
     half-way, new tiles like OSM never loaded). Heading now shows "—" and
     the updater is wrapped in try/catch
   • upstream panel headers keep their own layout (an earlier clip hid the
     +/– button, so collapsed panels couldn't reopen)
   • ocean: faint tactical grid on open water (darkMap.js)

## Upstream tests that now fail ON PURPOSE (they encode upstream defaults)
- src/mapStackChips.test.mjs — expects the 5 upstream sources (we add "dark")
- src/share/viewCodec.test.mjs — "defaults ... match today's app defaults"
- src/maps/controller.test.mjs — 6 imagery-comparison tests assume the
  default stack is photoreal / esri-imagery
- src/layers/streetLevel/providers/mapillary/provider.test.mjs — the
  provider-contract test checks for Mapillary green #05cb63 (we use blue)
Re-check these when moving to a new upstream release.
