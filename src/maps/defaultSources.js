import { MAP_STACKS } from './catalog.js';
import { photorealUnavailableReason } from './availability.js';
import { keySetupRequirementEnvVars } from '../keySetupCore.mjs';
import { t } from '../i18n/index.js';
import {
  createOsmImagery,
  createEsriImagery,
  createIonImagery,
  ESRI_ATTRIBUTION_HTML,
} from './imagery.js';
import {
  createDarkImagery,
  DARK_MAP_ATTRIBUTION_HTML,
} from '../missionControl/darkMap.js';
// Mission Control: Vector Dark trial map
import {
  createVectorDarkImagery,
  VECTOR_MAP_ATTRIBUTION_HTML,
} from '../missionControl/vectorMap.js';
import { createWorldTerrain, createKeylessTerrain } from './terrain.js';

/** Select sources and setup guidance without putting provider branches in the controller. */
export function createDefaultMapSources({
  googleTileset = null,
  cesiumToken = '',
  googleApiKey = '',
} = {}) {
  const ionToken = String(cesiumToken || '').trim();
  const hasIon = Boolean(ionToken);
  const hasGoogle = Boolean(String(googleApiKey || '').trim());
  const terrain = {
    id: hasIon ? 'world' : 'keyless',
    create: hasIon
      ? (request) => createWorldTerrain(ionToken, request)
      : createKeylessTerrain,
  };
  return {
    defaultId: 'vector', // Mission Control: Vector Dark first (falls back to Dark); 3D + satellite are toggles
    unknownId: 'photoreal',
    recoveryId: googleTileset ? 'photoreal' : null,
    state: { hasCesiumIonToken: hasIon },
    sources: MAP_STACKS.map((descriptor) => {
      const common = {
        descriptor,
        available: !descriptor.requiresIon || hasIon,
        unavailableReason: descriptor.requiresIon
          ? t('Needs {envVars} — add it in Provider Settings', {
              envVars: keySetupRequirementEnvVars('cesium-ion'),
            })
          : null,
      };
      if (descriptor.kind === 'photoreal')
        return {
          ...common,
          available: Boolean(googleTileset),
          unavailableReason: photorealUnavailableReason(hasIon || hasGoogle),
          tileset: googleTileset,
        };
      const imagery =
        descriptor.kind === 'ion'
          ? () => createIonImagery(descriptor.style, ionToken)
          : descriptor.id === 'dark'
            ? createDarkImagery
            : descriptor.id === 'vector' // Mission Control
              ? createVectorDarkImagery
            : descriptor.id === 'osm'
              ? createOsmImagery
              : createEsriImagery;
      return {
        ...common,
        imagery,
        terrain,
        ...(descriptor.id === 'dark'
          ? {
              credit: DARK_MAP_ATTRIBUTION_HTML,
              constructionFallback: {
                id: 'esri-imagery',
                message: 'Dark map is unavailable; using Esri Satellite',
              },
              tileFailureFallback: {
                id: 'esri-imagery',
                threshold: 2,
                message: 'Dark map tile requests failed; using Esri Satellite',
              },
            }
          : {}),
        // Mission Control: Vector Dark falls back to the Dark map
        ...(descriptor.id === 'vector'
          ? {
              credit: VECTOR_MAP_ATTRIBUTION_HTML,
              constructionFallback: { id: 'dark', message: 'Vector Dark map is unavailable; using Dark' },
              tileFailureFallback: { id: 'dark', threshold: 3, message: 'Vector Dark tile requests failed; using Dark' },
            }
          : {}),
        ...(descriptor.id === 'esri-imagery'
          ? {
              credit: ESRI_ATTRIBUTION_HTML,
              constructionFallback: {
                id: 'osm',
                message: 'Esri Satellite is unavailable; using OSM',
              },
              tileFailureFallback: {
                id: 'osm',
                threshold: 2,
                message: 'Esri Satellite tile requests failed; using OSM',
              },
            }
          : {}),
      };
    }),
  };
}
