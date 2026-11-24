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
// When the scene ends, Boss's own map and Relief setting come back.
import { VECTOR_MAP_ID } from './vectorMap.js';
import { overrideRelief } from './relief.js';

const PHOTO_STACKS = new Set(['photoreal', 'esri-imagery']);
const activeStack = () => document.querySelector('.map-stack-chip.active')?.dataset.stackId;

export function attachSceneMap() {
  let playing = false;
  let mapBefore = null;
  let restoreRelief = null;

  // Hook read by upstream's visualStateForShot (src/scenes/shotPresentation.js).
  globalThis.__mcSceneVisual = (visual) =>
    visual && PHOTO_STACKS.has(visual.mapStack) ? { ...visual, mapStack: VECTOR_MAP_ID } : visual;

  const sync = () => {
    const now = document.body.classList.contains('scene-playback-mode');
    if (now === playing) return;
    playing = now;
    if (now) {
      mapBefore = activeStack() ?? VECTOR_MAP_ID;
      restoreRelief = overrideRelief({ on: true, exaggeration: 1, strength: 0.5 });
    } else {
      restoreRelief?.();
      restoreRelief = null;
      // Let upstream finish its own clean-up first, then put the map back.
      setTimeout(() => {
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
