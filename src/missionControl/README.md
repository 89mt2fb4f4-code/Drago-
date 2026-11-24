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
14. Vector Dark trial map — vectorMap.js. New MAP SOURCE chip next to Dark.
   Keyless: fetches OpenFreeMap vector tiles (OpenMapTiles schema, the same
   data a MapLibre map uses) and paints each tile itself in the Mission
   Control palette — water, parks, buildings, roads by class, rail, country
   and state borders, tactical grid on water. Beyond zoom 14 it zooms into
   the z14 data, so streets stay sharp. No names painted in (they'd stretch
   when the 3D view tilts; screen-facing labels come next). Tiles go to
   Cesium upside down on purpose (Cesium uploads ImageBitmaps unflipped).
   Reveals detail as you zoom (2026-11-23): no borders from the whole
   globe; country borders from tile zoom 4, state borders from 6; highways
   from 6, main roads 8, streets 12.
   Falls back to Dark if tiles fail. Credits: OpenFreeMap, OpenMapTiles,
   OpenStreetMap. Upstream edits (one line each, like Dark): maps/catalog.js,
   maps/defaultSources.js, mapStackChips.js, view/index.js,
   share/viewCodec.js (appended), layers/submarineCables/policy.js.
15. Names on Vector Dark — vectorLabels.js (started from shell.js). Only
   while Vector Dark is chosen. Countries, states, cities, towns,
   neighbourhoods, water, streets and landmarks from the same OpenFreeMap
   tiles, as Cesium labels: upright, sharp, clamped to the ground. Kept
   clean: each kind shows only within a camera distance (streets/landmarks
   up close), bigger places win overlaps, no names under panels or the
   screen's top/bottom edge, a name isn't repeated within 320 px, at most
   16 street and 6 landmark names at once. Small amenities (benches, ATMs,
   shops, cafés…) are skipped. Refreshes when the camera stops; every
   handler is wrapped so a label error can't stop the map drawing.
   No upstream edits.
   Ranges: no names from the whole globe or the whole flat map; countries
   within 9,000 km, states 3,000 km, cities 1,500 km, towns 200 km,
   neighbourhoods 16 km, streets/landmarks a few km. Each fades in over the
   last 30% of its range (Cesium translucencyByDistance).
16. Overture Maps on Vector Dark — overture.js, pmtiles.js. Read straight
   from Overture's public PMTiles (small HTTP range requests; the newest
   release is found from the bucket listing, falls back to older ones).
   • 3D buildings (zoom 14 tiles, 3 × 3 around the point in view, within
     9 km): real footprints and heights (height, else floors × 3.3 m, else
     7 m); tower parts keep their own base. Sit on the terrain (one height
     sample per tile). Navy → violet by height. Not clickable, so clicks
     still reach cameras/markers. Hidden in flat MAP view and on other maps.
     If Cesium ever fails drawing them, they switch off for the session and
     the map keeps drawing.
   • Names: public places from Overture Places (hotels, museums, parks,
     stations, venues… confidence ≥ 0.9, open, within 3.5 km; skipped if
     known only from a business registry, e.g. BrightQuery LLC filings).
     Building names come from OSM tags that can be years old, so only
     landmarks ≥ 40 m get one (max 5 at once), and a fresh Overture place
     inside the footprint replaces it. Only the name is used — never
     phones, emails or socials — and private services (law offices,
     clinics, home services…) are left out. Fed to vectorLabels.js via
     setExtraNames().
   • Credit "© Overture Maps Foundation" on screen while Vector Dark is on.
     theme.css: the credit line now wraps before the centred voice box
     instead of running under it.
   pmtiles.js is a tiny PMTiles v3 reader (no library; gzip via the
   browser's DecompressionStream); tile ids checked against the spec.
17. Vector Dark is the start map (Dark stays as its automatic fallback and
   a MAP SOURCE choice). Upstream edits: app/scene.js (initialStack +
   first setStack), maps/defaultSources.js (defaultId). Share-link codec
   defaults unchanged (frozen by design).
18. Focus panel names the real place — placeName.js, shell.js. Offline, no
   key: nearest city/town/village from OpenFreeMap place points (same tiles
   as Vector Dark), state/province + country from upstream's bundled Natural
   Earth borders (src/data/local_data/natural_earth), lakes/seas from the
   tiles' water polygons + water names, open ocean from Natural Earth marine
   areas. "Buffalo, NY", "Toronto, ON", "Paris, France", "New York, USA"
   (zoomed out), "USA" (globe), "Lake Erie", "North Atlantic Ocean"; "—"
   when unknown. Looked up 300 ms after the camera settles, cached.
   Local time still solar (UTC±n) away from Buffalo.
   DISPLAY panel: Clean UI button hidden (theme.css); the top bar's CLEAN UI
   chip still presses it.
19. Relief mode — relief.js (Visual Presets → TERRAIN: Relief switch +
   1× / 1.5× / 2× / 3× height chips; remembered per browser). A globe
   material on the real terrain (keyless Re:Earth / Mapterhorn DEM):
   slopes become grey-violet hill shading (light from the north-west, from
   Cesium's slope + aspect), flat ground fades back to the map so streets,
   water and names stay; soft contour lines every 20 m–1 km by zoom, every
   5th brighter. Height exaggeration is centred on the real ground height
   where Boss looks (re-centred after 50 km moves), so ground markers there
   stay put. Overture buildings hide when heights are exaggerated (they're
   placed at real height) and return at 1×. A draw error switches Relief
   off and restarts the map. Upstream edit: src/maps/terrain.js
   (keyless terrain now requests vertex normals, needed for shading).
20. TILT slider — tiltSlider.js. Slides out beside the map-button column
   while the pointer is over it (or for 4 s after the tilt button), hides
   1.2 s after leaving. 0° straight down … 85° near the horizon; orbits the
   point in the middle of the screen (upstream's readCameraTargetFrame) and
   keeps following a tracked object. Shows the current tilt after any other
   move; greyed out in flat MAP view; arrow keys work, upstream one-letter
   shortcuts are blocked while it has focus. No upstream edits.
21. Globe look (idea from a 21st.dev React/three.js "3D globe", rebuilt in
   Cesium instead of adding React + a second globe) — globeLook.js.
   • Auto-spin: whole globe in view (camera > 6,000 km), 3D, nothing
     tracked, no fly-to running, and no click/scroll/touch/key for 3 s →
     turns west → east at 2°/s (a turn in 3 min). Any input stops it at
     once. Any map source. Switch: Visual Presets → GLOBE (remembered per
     browser, on by default). Uses upstream's holdContinuousRender while
     turning (requestRenderMode would otherwise stop drawing).
   • Violet edge glow: Cesium sky atmosphere hue/brightness shifted.
   • Faint 15° latitude/longitude grid (12 km up), only above 3,000 km and
     only on the 3D globe (on the flat MAP it read as graph paper).
22. Double-click a region — regionSelect.js (Pinterest refs: glowing region
   outline + side info). Double-click the map (not a marker) from > 150 km:
   country (camera > 3,000 km) or state/province (closer; country if there
   is none). Double, so ordinary clicks/drags never select; skipped while
   upstream's draw / imagery-box tools are on (body.gev-drawing /
   gev-imagery-box). Inside the highlight the next level's lines appear as
   you zoom in (DistanceDisplayCondition): a country's states/provinces from
   7,500 km, a US state's counties (US Census pack) from 1,200 km
   (placeName.js unitsWithin). Top fill is 85% solid so the depth layer
   doesn't show through as a seam.
   Glowing violet ground outline (PolylineGlow, clampToGround, biggest 60
   parts) on a violet fill, made to look lifted (Pinterest ref) with flat
   ground layers, no real height (raised outlines spiked on coastlines):
   a deep-violet copy shifted 2.8% of the region's size towards screen
   bottom-right (its thick edge) and two black copies at 5.5% / 8.5% (soft
   shadow). Redrawn when the map turns > 20°. Fill and outline use rhumb
   edges so long straight borders (49°N) line up. REGION card (03; Signals is now 04) docks at the top
   of upstream's right panel stack when it shows (its layout moves CCTV etc.
   below), else in #mc-right before Signals; on small screens only the card
   shows. Card: name, type · country, capital, population + year, currency
   (countries) or ISO code (states), area ≈ from the Natural Earth shape,
   a short Wikipedia description and link, ZOOM TO. Facts from Wikidata
   (SPARQL by ISO 3166 code, validated) and Wikipedia's summary API — free,
   no key, cached per region; "—" when unknown. Same region again, open
   sea, × or Esc clears it. The globe doesn't auto-spin while a region is
   selected (html[data-mc-region]). placeName.js now exports adminUnitAt().
23. Top bar + bottom (theme.css): the MISSION CONTROL plate is always
   centred (side columns minmax(0, 1fr); the wide right side reaches into
   the gap instead of pushing the plate left). Below 1700px the stamp uses
   the short date ("NOV 23") to stay clear of the TOOLS wing. Upstream's
   "AI AGENT · VOICE STANDBY" box (#gev-voice-control) is hidden.
24. Scenes on our map — sceneMap.js. While a scene plays (body.scene-
   playback-mode), ordinary shots use Vector Dark instead of Google 3D /
   Esri; the Nepal before/after imagery-comparison beats still use
   satellite (upstream returns them before the hook). Relief is on at 1×,
   half strength (scenes turn bloom up), via relief.js overrideRelief()
   (not saved). On END SCENE the previous map and Relief setting come back.
   Upstream edit: src/scenes/shotPresentation.js (visualStateForShot passes
   its result through globalThis.__mcSceneVisual). The look is restored too:
   upstream's styleManager.getVisualState() is saved at scene start and
   applyVisualState() puts back bloom, sharpen, detection, HUD, look preset.
25. Data layer restyle, batch 1 — palette.js (one palette for all layers:
   movement lavender/violet, military/sensors blue, selected white, amber
   only for real alerts). Upstream edits, each marked:
   • ui/visualPresets.js — detection boxes OFF by default (was DENSE)
   • data/aircraftEmergency.js — emergency tint amber (was red)
   • layers/flights/policy.js, rendering.js, tracking.js — civil lavender
     (was white), military blue (was amber), followed plane white (was
     cyan), violet trails (was cyan), far planes 0.22× (was 0.5×), near 2.4×
   • layers/military/policy.js, rendering.js — blue icons/trails, white when
     followed, same far/near scale
   • data/satelliteClass.js — class colours (station, nav, geo, visual,
     comms) from the palette; layers/satellites/policy.js ISS lavender (was
     red), 10 px; rendering.js orbit lines violet, thinner, fainter;
     tracking.js followed satellite white dot + violet ring and orbit (was
     yellow); ingestion.js, catalog.js far dots 0.45× (was 0.6×)
26. Data layer restyle, batch 2 — palette.js colours in:
   • layers/traffic/policy.js — flow free lavender / slow white / jam amber
     (was green / amber / red), jam line 6 px (was 9), pulse ±0.08 (was
     ±0.2), slow line lavender 0.15; model.js, animation.js — roads without
     flow slate 0.55 (was white); roadModes.js — with a TomTom key the
     default is TomTom-only (was Hybrid with simulated OSM roads)
   • layers/transit/policy.js, trails.js — mode colours from the palette
   • layers/bikeshare/policy.js — many/some/few bikes lavender/violet/dim
     blue (was green/orange/red); selection.js — selected station white
   • data/vesselLabels.js — ship type colours + card accents; layers/
     vessels/policy.js — trail soft blue (was #39ffd5)
27. Data layer restyle, batch 3 — palette.js colours in:
   • layers/cctv/policy.js — cameras blue at rest / white active / lavender
     live (was cyan / yellow / violet); view cones blue and lavender (was
     cyan / green); projection.js accent blue
   • layers/alpr/policy.js — camera spots slate, selected white (was cyan /
     red)
   • layers/earthquakes/model.js — depth shallow amber / mid lavender / deep
     violet (was red / orange / yellow)
   • layers/firms/policy.js, model.js — fire heat amber shades (was red /
     orange / yellow; stop names kept)
   • layers/perimeters/cards.js — containment amber → lavender → slate (was
     red / orange / yellow / green)

## Upstream tests that now fail ON PURPOSE (they encode upstream defaults)
- src/mapStackChips.test.mjs — expects the 5 upstream sources (we add "dark")
- src/share/viewCodec.test.mjs — "defaults ... match today's app defaults"
- src/maps/controller.test.mjs — 6 imagery-comparison tests assume the
  default stack is photoreal / esri-imagery
- src/layers/streetLevel/providers/mapillary/provider.test.mjs — the
  provider-contract test checks for Mapillary green #05cb63 (we use blue)
- src/voice/gevActions.test.mjs — "every live basemap is reachable by its
  own id": our `dark` and `vector` maps have no voice alias
- src/data/aircraftEmergencyAnalyst.test.mjs — 2 tests check red emergency /
  amber military tints (we use amber alerts / blue military)
- src/data/vesselLabels.test.mjs, src/layers/transit/lifecycle.test.mjs — 1
  test each checks the old ship / transit colours
- src/layers/traffic/roadModes.test.mjs — 3 tests assume Hybrid is the keyed
  default (we default to TomTom-only)
- src/layers/perimeters/ownership.test.mjs — 1 test checks the old
  containment legend colours
Re-check these when moving to a new upstream release.
