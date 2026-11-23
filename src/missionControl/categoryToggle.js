// Mission Control — one switch per Data Layers category (Movement, Cameras…).
//
// Upstream lists each layer with its own ON/OFF button under plain headings.
// We add a small switch to each heading:
//   • any layer in the category on → switch shows ON; a click turns them all OFF
//   • all off → a click turns them all ON
// It works by pressing the category's own row buttons, so upstream's normal
// on/off logic (loading, errors, URL state) runs exactly as if Boss clicked
// each one. Clicks are spaced out a little so the map doesn't stall.

const STAGGER_MS = 120;

export function attachCategoryToggles() {
  const list = document.getElementById('data-toggles');
  if (!list) return;

  // Rows that belong to a heading: siblings up to the next heading.
  const rowsOf = (heading) => {
    const rows = [];
    for (let el = heading.nextElementSibling; el && !el.matches('.data-layer-group-heading'); el = el.nextElementSibling) {
      if (el.matches('.data-toggle-row')) rows.push(el);
    }
    return rows;
  };
  const btnOf = (row) => row.querySelector('.data-toggle-btn');
  const isOn = (row) => Boolean(btnOf(row)?.classList.contains('active'));

  function press(heading) {
    const name = heading.dataset.mcGroup;
    const rows = rowsOf(heading);
    const turnOff = rows.some(isOn);
    // Re-find each row by layer id at click time: upstream may re-render.
    const ids = rows.filter((r) => isOn(r) === turnOff).map((r) => r.dataset.layerId);
    ids.forEach((id, i) => setTimeout(() => {
      const row = list.querySelector(`.data-toggle-row[data-layer-id="${CSS.escape(id)}"]`);
      const btn = row && btnOf(row);
      if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
      if (isOn(row) === turnOff) btn.click();
    }, i * STAGGER_MS));
    if (!ids.length) console.info(`[Mission Control] ${name}: nothing to switch`);
  }

  function sync() {
    for (const heading of list.querySelectorAll('.data-layer-group-heading')) {
      let sw = heading.querySelector('.mc-group-switch');
      if (!sw) {
        heading.dataset.mcGroup = heading.textContent.trim();
        sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'mc-group-switch';
        sw.innerHTML = '<span class="mc-group-knob"></span>';
        sw.addEventListener('click', (e) => { e.stopPropagation(); press(heading); });
        heading.append(sw);
      }
      const rows = rowsOf(heading);
      const on = rows.filter(isOn).length;
      const state = on === 0 ? 'off' : on === rows.length ? 'on' : 'some';
      if (sw.dataset.state !== state) {
        sw.dataset.state = state;
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-checked', state === 'off' ? 'false' : 'true');
        const name = heading.dataset.mcGroup;
        sw.title = state === 'off' ? `Turn all ${name} on` : `Turn all ${name} off`;
        sw.setAttribute('aria-label', sw.title);
      }
    }
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  };
  new MutationObserver((muts) => {
    // Ignore our own switch updates.
    if (muts.every((m) => m.target.closest?.('.mc-group-switch'))) return;
    schedule();
  }).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  sync();
}
