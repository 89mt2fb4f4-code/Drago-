// Mission Control — full-screen HUD frame (EASYV reference): one thin glowing
// outline around the whole display, rounded corners, a gap where the top
// plate hangs, a raised bevel in the bottom centre, and side ticks.
// Drawn in real pixels and redrawn on resize, so strokes never stretch.
const NS = 'http://www.w3.org/2000/svg';

export function attachHudFrame() {
  const host = document.getElementById('mc-frame');
  if (!host || host.querySelector('.mc-hud')) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'mc-hud');
  svg.setAttribute('aria-hidden', 'true');
  host.append(svg);

  function draw() {
    const W = innerWidth, H = innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const m = 8, r = 18;               // margin, corner radius
    const plate = Math.min(660, W - 2 * m - 80) / 2; // half gap for the top plate
    const cx = W / 2;
    const bw = Math.min(300, W / 4), bh = 12; // bottom bevel half-width, rise
    const outline = [
      `M ${cx - plate} ${m}`,
      `H ${m + r} Q ${m} ${m} ${m} ${m + r}`,
      `V ${H - m - r} Q ${m} ${H - m} ${m + r} ${H - m}`,
      `H ${cx - bw - 24} L ${cx - bw} ${H - m - bh} H ${cx + bw} L ${cx + bw + 24} ${H - m}`,
      `H ${W - m - r} Q ${W - m} ${H - m} ${W - m} ${H - m - r}`,
      `V ${m + r} Q ${W - m} ${m} ${W - m - r} ${m}`,
      `H ${cx + plate}`,
    ].join(' ');
    const ticks = [];
    for (const y of [H * 0.38, H * 0.5, H * 0.62]) {
      ticks.push(`M ${m + 4} ${y} h 10`, `M ${W - m - 4} ${y} h -10`);
    }
    svg.innerHTML = `
      <path class="mc-hud-line" d="${outline}"/>
      <path class="mc-hud-bevel" d="M ${cx - bw} ${H - m - bh} H ${cx + bw}"/>
      <path class="mc-hud-tick" d="${ticks.join(' ')}"/>
      <path class="mc-hud-corner" d="M ${m} ${m + r + 26} V ${m + r} Q ${m} ${m} ${m + r} ${m} H ${m + r + 26}
        M ${W - m - r - 26} ${m} H ${W - m - r} Q ${W - m} ${m} ${W - m} ${m + r} V ${m + r + 26}
        M ${m} ${H - m - r - 26} V ${H - m - r} Q ${m} ${H - m} ${m + r} ${H - m} H ${m + r + 26}
        M ${W - m - r - 26} ${H - m} H ${W - m - r} Q ${W - m} ${H - m} ${W - m} ${H - m - r} V ${H - m - r - 26}"/>`;
  }
  draw();
  addEventListener('resize', draw);
}
