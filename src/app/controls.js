import { catalogControlServices } from './catalog.js';
import { StyleManager } from '../ui/composition.js';
// Mission Control: home city first (src/missionControl/home.js)
import { flyToHomeCity, HOME_CITY } from '../missionControl/home.js';
import { attachMissionControl } from '../missionControl/shell.js';
import { initCockpitCloudEffects } from '../cockpitCloudEffects.js';
import { t } from '../i18n/index.js';

/**
 * Construct the existing controls and camera presentation. `initialShareCode`
 * opens a share code (the `<code>` of `/share/<code>`) at start-up, for a host
 * whose address does not carry one.
 */
export function createApplicationControls({
  scene: { viewer, mapStackController, operations },
  loaderStatus,
  Controls = StyleManager,
  services,
  catalog,
  placeSearch,
  defer,
  initialShareCode = null,
}) {
  // Initialize the style manager (post-processing, HUD, locations, share links)
  const styleManager = new Controls(viewer, {
    services: {
      ...services,
      ...operations.surface.controlServices,
      searchAndFlyTo: operations.searchAndFlyTo,
      fetchRegionalBrief: (...args) =>
        operations.requests.regional.getBrief(...args),
      ...catalogControlServices(catalog),
    },
    requestServices: operations.requests,
    mapStackController,
    placeSearch,
    // A share code to open at start-up instead of the page's address.
    initialShareCode,
  });
  defer(() => styleManager.orbitController.stop());
  defer(() => styleManager.hud.destroy());
  defer(() => styleManager.dispose());
  // The previous multi-canvas weather compositor remains disabled. Cockpit
  // clouds use a separate, capped low-resolution GPU pass that never attaches
  // Cesium fog or post-process stages and is fully stopped in map mode.
  const weatherEffects = null;
  const cockpitCloudEffects = initCockpitCloudEffects(viewer, {
    weatherService: operations.requests.weather,
  });
  defer(() => cockpitCloudEffects?.destroy());

  // Mission Control: no share link → open on the home city, not Austin.
  if (!styleManager.hasShareState) {
    loaderStatus.textContent = `Flying to ${HOME_CITY.name}...`;
    defer(flyToHomeCity(viewer));
  } else {
    loaderStatus.textContent = t('Restoring shared view...');
  }

  attachMissionControl(viewer); // Mission Control: view chips + Focus panel
  return { styleManager, weatherEffects, cockpitCloudEffects };
}
