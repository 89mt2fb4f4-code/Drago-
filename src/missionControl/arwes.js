// Mission Control — Arwes accents (frames + background), trial.
// Uses only Arwes's framework-free packages (@arwes/frames, @arwes/bgs),
// pinned in package.json. Arwes is unmaintained upstream, so everything it
// touches lives here and can be removed by deleting this file and its import.
//
// Both are drawn static (no Arwes animator): no flicker over the map, and they
// redraw themselves on resize. Colours come from our palette via the CSS
// variables Arwes reads (--arwes-frames-*), set in theme.css.
import {
  createFrame,
  createFrameNefrexSettings,
  styleFrameClipOctagon,
} from '@arwes/frames';
import { createBackgroundDots } from '@arwes/bgs';

// Nefrex: cut corners top-left + bottom-right (like our brackets) plus Arwes's
// short/long accent lines along the edges.
const CORNERS = { leftTop: true, rightTop: false, rightBottom: true, leftBottom: false };
const SVG_NS = 'http://www.w3.org/2000/svg';
const FRAME_COLORS = {
  '--arwes-frames-bg-color': 'var(--mc-panel, rgba(9, 12, 28, 0.82))',
  '--arwes-frames-line-color': 'rgba(155, 135, 255, 0.6)', // --mc-purple
  '--arwes-frames-line-filter': 'drop-shadow(0 0 3px rgba(155, 135, 255, 0.45))',
};

// Every Mission Control surface, ours and the upstream ones we restyle.
// "small" = short bars (collapsed panels, command bar): tighter corners/lines.
const TARGETS = [
  { sel: '#mc-brief' },
  { sel: '#mc-focus' },
  { sel: '#mc-right .mc-drago' },
  { sel: '#mc-signals' },
  { sel: '#mc-command .mc-input', small: true },
  { sel: '#left-panel-stack > [data-panel-id]', small: true },
  { sel: '#right-context-rail > [data-panel-id], #pp-toggles', small: true },
];

function framePanel(el, small) {
  if (!el || el.querySelector(':scope > .mc-arwes-frame')) return;
  const squareSize = small ? 10 : 14;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'mc-arwes-frame');
  svg.setAttribute('aria-hidden', 'true');
  // Colours set right on the frame, so it never depends on stylesheet timing:
  // without them Arwes falls back to the text colour and paints a white box.
  for (const [k, v] of Object.entries(FRAME_COLORS)) svg.style.setProperty(k, v);
  el.prepend(svg);
  el.classList.add('mc-arwes');
  // Clip the element (and its backdrop blur) to the frame's outline.
  el.style.clipPath = styleFrameClipOctagon({ squareSize, ...CORNERS });
  createFrame(svg, createFrameNefrexSettings({
    animated: false, strokeWidth: 1, squareSize, ...CORNERS,
    smallLineLength: small ? 10 : 16,
    largeLineLength: small ? 36 : 64,
  }));
}

function background() {
  if (document.getElementById('mc-arwes-bg')) return;
  const canvas = document.createElement('canvas');
  canvas.id = 'mc-arwes-bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  // Sizes are in canvas pixels (Arwes draws at up to 2x density):
  // 8 → ~4px crosses on a ~30px grid.
  createBackgroundDots({
    canvas,
    settingsRef: {
      current: {
        type: 'cross',
        size: 8,
        crossSize: 1.5,
        distance: 60,
        origin: 'center',
        color: 'rgba(155, 135, 255, 0.35)', // --mc-purple
      },
    },
  });
}

export function attachArwes() {
  for (const { sel, small } of TARGETS) {
    document.querySelectorAll(sel).forEach((el) => framePanel(el, small));
  }
  background();
}
