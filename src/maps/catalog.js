import * as Cesium from 'cesium';
export const MAP_STACKS = [
  // Mission Control: dark grey default map (src/missionControl/darkMap.js)
  {
    id: 'dark',
    label: 'Dark', // i18n-ignore: map name
    shortLabel: 'DARK',
    kind: 'dark',
    requiresIon: false,
  },
  // Mission Control: Vector Dark trial map (src/missionControl/vectorMap.js)
  {
    id: 'vector',
    label: 'Vector Dark', // i18n-ignore: map name
    shortLabel: 'VECTOR',
    kind: 'vector',
    requiresIon: false,
  },
  {
    id: 'photoreal',
    label: 'Google 3D', // i18n-ignore: imagery product name
    shortLabel: '3D',
    kind: 'photoreal',
    requiresIon: false,
  },
  {
    id: 'bing-aerial',
    label: 'Bing Aerial', // i18n-ignore: imagery product name
    shortLabel: 'Aerial',
    kind: 'ion',
    style: Cesium.IonWorldImageryStyle.AERIAL,
    requiresIon: true,
  },
  {
    id: 'bing-labels',
    label: 'Bing Labels', // i18n-ignore: imagery product name
    shortLabel: 'Labels',
    kind: 'ion',
    style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS,
    requiresIon: true,
  },
  {
    id: 'esri-imagery',
    label: 'Esri Satellite', // i18n-ignore: imagery product name
    shortLabel: 'SAT',
    kind: 'esri-imagery',
    requiresIon: false,
  },
  {
    id: 'osm',
    label: 'OSM', // i18n-ignore: imagery product name
    shortLabel: 'OSM',
    kind: 'osm',
    requiresIon: false,
  },
];
