import * as Location from 'expo-location';
import { Linking } from 'react-native';

export type Coords = { latitude: number; longitude: number };

/** Why the phone's position could not be read, so the screen can say something useful and offer a way forward. */
export type GpsFailure = {
  ok: false;
  reason: 'denied' | 'blocked' | 'services-off' | 'timeout' | 'error';
  message: string;
  /** True when the only fix is the device's settings screen. */
  openSettings?: boolean;
};
export type GpsResult = ({ ok: true } & Coords) | GpsFailure;

const FIX_TIMEOUT_MS = 15000;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });

/** Asks for permission if needed and reads the current position once. Never throws. */
export async function getCurrentCoords(): Promise<GpsResult> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return {
        ok: false,
        reason: 'services-off',
        message: 'Location is turned off on this phone. Turn on GPS, or search by area below.',
      };
    }
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted' && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return perm.canAskAgain
        ? { ok: false, reason: 'denied', message: 'Location permission was not given. You can still search by area below.' }
        : {
            ok: false,
            reason: 'blocked',
            openSettings: true,
            message: 'Location access is blocked for this app. Allow it in Settings, or search by area below.',
          };
    }
    try {
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), FIX_TIMEOUT_MS);
      return { ok: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      // A fix can take long indoors; an older position is far better than none for "stays near me".
      const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null);
      if (last) return { ok: true, latitude: last.coords.latitude, longitude: last.coords.longitude };
      return {
        ok: false,
        reason: 'timeout',
        message: 'Could not get your location in time. Move near a window and try again, or search by area below.',
      };
    }
  } catch {
    return { ok: false, reason: 'error', message: 'Could not read your location. You can search by area below.' };
  }
}

export const openLocationSettings = () => Linking.openSettings();
