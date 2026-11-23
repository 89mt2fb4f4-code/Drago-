// Mission Control — TILT slider beside the map-button column (bottom right).
// It slides out while the pointer is over the map buttons (or the slider),
// and for a few seconds after the tilt button is pressed — out of the way
// the rest of the time.
//
// Upstream's tilt button only jumps between straight-down and 35°. This
// slider sets any tilt from 0° (straight down) to 85° (almost the horizon),
// turning the camera around the point in the middle of the screen so what
// Boss is looking at stays centred. It follows the camera too: after any
// other move it shows the current tilt. Not used in flat MAP view.
import * as Cesium from 'cesium';
import { readCameraTargetFrame } from '../ui/cameraOrientationControls.js';

const MAX_TILT = 85;

// pitch −90° = straight down = tilt 0°.
const tiltOf = (pitch) => Math.round(Cesium.Math.toDegrees(pitch) + 90);
const pitchOf = (tilt) => Cesium.Math.toRadians(tilt - 90);

/** Orbit to a new pitch around frame.target, then free the camera again. */
function applyPitch(viewer, frame, pitch) {
  const camera = viewer.camera;
  const tracked = viewer.trackedEntity ? Cesium.Matrix4.clone(camera.transform) : null;
  camera.lookAt(frame.target, new Cesium.HeadingPitchRange(frame.heading, pitch, frame.range));
  if (tracked) camera.lookAtTransform(tracked); // keep following what's tracked
  else camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.scene.requestRender();
}

export function attachTiltSlider(viewer) {
  const column = document.getElementById('top-center-actions');
  if (!column || document.getElementById('mc-tilt')) return;
  const scene = viewer.scene;

  const box = document.createElement('div');
  box.id = 'mc-tilt';
  box.innerHTML = `
    <span class="mc-tilt-label">TILT</span>
    <input type="range" min="0" max="${MAX_TILT}" step="1" value="0" aria-label="Map tilt in degrees">
    <span class="mc-tilt-value">0°</span>`;
  document.body.append(box);
  const input = box.querySelector('input');
  const readout = box.querySelector('.mc-tilt-value');

  const place = () => {
    const r = column.getBoundingClientRect();
    box.style.right = `${Math.round(innerWidth - r.left + 10)}px`;
    box.style.bottom = `${Math.round(innerHeight - r.bottom)}px`;
    box.style.height = `${Math.round(r.height)}px`;
  };
  place();
  addEventListener('resize', place);
  // The column can move when panels open or close.
  new ResizeObserver(place).observe(column);

  // Show on hover / after the tilt button; hide shortly after leaving.
  let hideTimer = 0;
  const open = (ms) => {
    clearTimeout(hideTimer);
    place();
    box.classList.add('is-open');
    if (ms) hideTimer = setTimeout(close, ms);
  };
  const close = () => {
    if (dragging || box.matches(':hover') || box.contains(document.activeElement)) return;
    box.classList.remove('is-open');
  };
  const closeSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(close, 1200); };
  for (const el of [column, box]) {
    el.addEventListener('pointerenter', () => open());
    el.addEventListener('pointerleave', closeSoon);
  }
  box.addEventListener('focusin', () => open());
  box.addEventListener('focusout', closeSoon);
  document.getElementById('tilt-map-view')?.addEventListener('click', () => open(4000));

  let frame = null; // orbit frame captured when a drag starts
  let dragging = false;
  const show = (tilt) => {
    input.value = String(tilt);
    readout.textContent = `${tilt}°`;
  };

  function start() {
    if (scene.mode !== Cesium.SceneMode.SCENE3D) return;
    frame = readCameraTargetFrame(viewer);
    dragging = Boolean(frame);
  }
  input.addEventListener('pointerdown', start);
  input.addEventListener('keydown', () => { if (!dragging) start(); });
  input.addEventListener('input', () => {
    const tilt = Number(input.value);
    readout.textContent = `${tilt}°`;
    if (!frame) start();
    if (!frame) return;
    try { applyPitch(viewer, frame, pitchOf(tilt)); } catch (err) { console.warn('[Mission Control] tilt skipped:', err); }
  });
  const end = () => { dragging = false; frame = null; closeSoon(); };
  input.addEventListener('change', end);
  input.addEventListener('pointerup', end);
  input.addEventListener('blur', end);
  // Upstream's one-letter shortcuts must not fire while the slider has focus.
  input.addEventListener('keydown', (e) => e.stopPropagation());

  // Follow the camera after other moves (mouse, tilt button, fly-tos).
  function sync() {
    const flat = scene.mode !== Cesium.SceneMode.SCENE3D;
    input.disabled = flat;
    box.classList.toggle('is-off', flat);
    if (flat || dragging) return;
    try {
      const f = readCameraTargetFrame(viewer);
      if (f && Number.isFinite(f.pitch)) show(Math.max(0, Math.min(MAX_TILT, tiltOf(f.pitch))));
    } catch { /* keep the last value */ }
  }
  scene.camera.moveEnd.addEventListener(sync);
  scene.morphComplete.addEventListener(sync);
  setTimeout(sync, 1500);
}
