// Mission Control — Arwes accents (frames), trial.
// Uses only Arwes's framework-free frames package (@arwes/frames),
// pinned in package.json. Arwes is unmaintained upstream, so everything it
// touches lives here and can be removed by deleting this file and its import.
//
// Frames are drawn static (no Arwes animator): no flicker over the map, and
// they redraw themselves on resize. Colours come from our palette via the CSS
// variables Arwes reads (--arwes-frames-*), set on each frame below.
import {
  createFrame,
  createFrameNefrexSettings,
  styleFrameClipOctagon,
} from '@arwes/frames';

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

export function attachArwes() {
  for (const { sel, small } of TARGETS) {
    document.querySelectorAll(sel).forEach((el) => framePanel(el, small));
  }
}
