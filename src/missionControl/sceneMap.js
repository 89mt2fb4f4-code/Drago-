// Mission Control — scenes (Scenes panel → START) on our own map.
//
// Upstream scenes ask for Google 3D, falling back to Esri satellite, for every
// shot, and leave the map that way afterwards. While a scene plays:
//   • ordinary shots use Vector Dark instead
//   • shots that compare before/after satellite photos (Nepal evidence beats)
//     keep satellite — upstream returns those before our hook runs
//   • Relief is on at 1× (shading + contours, real heights, so nothing the
//     scene places at ground level sinks), painted at half strength because
//     scenes turn their glow (bloom) up
// When the scene ends, Boss's own map, Relief setting and look come back —
// glow (bloom), sharpen, detection, HUD and look preset as they were before
// (upstream's own getVisualState / applyVisualState).
import { VECTOR_MAP_ID } from './vectorMap.js';
import { overrideRelief } from './relief.js';

const PHOTO_STACKS = new Set(['photoreal', 'esri-imagery']);
const activeStack = () => document.querySelector('.map-stack-chip.active')?.dataset.stackId;

export function attachSceneMap() {
  let playing = false;
  let mapBefore = null;
  let lookBefore = null;
  let restoreRelief = null;
  const looks = () => window.__godsEyeView?.styleManager;

  // Hook read by upstream's visualStateForShot (src/scenes/shotPresentation.js).
  globalThis.__mcSceneVisual = (visual) =>
    visual && PHOTO_STACKS.has(visual.mapStack) ? { ...visual, mapStack: VECTOR_MAP_ID } : visual;

  const sync = () => {
    const now = document.body.classList.contains('scene-playback-mode');
    if (now === playing) return;
    playing = now;
    if (now) {
      mapBefore = activeStack() ?? VECTOR_MAP_ID;
      try { lookBefore = looks()?.getVisualState?.() ?? null; } catch { lookBefore = null; }
      restoreRelief = overrideRelief({ on: true, exaggeration: 1, strength: 0.5 });
    } else {
      restoreRelief?.();
      restoreRelief = null;
      // Let upstream finish its own clean-up first, then put the map back.
      setTimeout(async () => {
        const look = lookBefore;
        lookBefore = null;
        if (look) {
          try {
            await looks()?.applyVisualState?.({ ...look, mapStack: mapBefore ?? look.mapStack });
          } catch (err) {
            console.warn('[Mission Control] look not restored after scene:', err);
          }
        }
        if (mapBefore && activeStack() !== mapBefore) {
          document.querySelector(`.map-stack-chip[data-stack-id="${mapBefore}"]`)?.click();
        }
        mapBefore = null;
      }, 600);
    }
  };
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
}
