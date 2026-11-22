// Mission Control — home city (Drago spec §8.7 A: "home city first").
// Our own file: upstream God's Eye code stays untouched except one import
// in src/app/controls.js. Change HOME_CITY here to move the default view.
import * as Cesium from 'cesium';

export const HOME_CITY = Object.freeze({
  name: 'Buffalo, NY',
  lon: -78.8784, // downtown Buffalo
  lat: 42.8864,
  approachAltitude: 25000, // metres — starting height before the fly-in
  viewAltitude: 1800, //      metres — final city view height
  heading: 20, //             degrees
  pitch: -35, //              degrees (looking down at the city)
});

/**
 * Open on the home city with a short fly-in (replaces the upstream Austin
 * start). Returns a cancel function, same contract as upstream flyToAustin.
 */
export function flyToHomeCity(viewer, city = HOME_CITY) {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      city.lon,
      city.lat,
      city.approachAltitude,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
  });

  const timer = setTimeout(() => {
    if (viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        city.lon,
        city.lat,
        city.viewAltitude,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(city.heading),
        pitch: Cesium.Math.toRadians(city.pitch),
        roll: 0.0,
      },
      duration: 4.0,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, 500);

  return () => {
    clearTimeout(timer);
    if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
  };
}
