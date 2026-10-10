import { useState, useCallback } from 'react';
import type { LocalityOption } from '../types/intelligence';

export type GeolocationStatus = 'idle' | 'locating' | 'success' | 'denied' | 'error' | 'timeout';

const STORAGE_KEY = 'myarea24_selected_location';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getSavedLocation(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveSelectedLocation(name: string): void {
  try {
    if (name) {
      localStorage.setItem(STORAGE_KEY, name);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage quota or private browsing errors
  }
}

export function findNearestLocality(
  lat: number,
  lon: number,
  localities: LocalityOption[]
): { locality: LocalityOption; distanceKm: number } | null {
  if (!localities || localities.length === 0) return null;

  let nearest: LocalityOption = localities[0];
  let minDistance = haversineKm(lat, lon, nearest.latitude, nearest.longitude);

  for (let i = 1; i < localities.length; i++) {
    const loc = localities[i];
    const dist = haversineKm(lat, lon, loc.latitude, loc.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = loc;
    }
  }

  return { locality: nearest, distanceKm: Math.round(minDistance * 10) / 10 };
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectedLocality, setDetectedLocality] = useState<LocalityOption | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const detectLocation = useCallback(
    (localities: LocalityOption[]): Promise<LocalityOption | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          setStatus('error');
          setErrorMsg('Geolocation is not supported by your browser.');
          resolve(null);
          return;
        }

        setStatus('locating');
        setErrorMsg(null);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCoords({ latitude, longitude });
            setStatus('success');

            const result = findNearestLocality(latitude, longitude, localities);
            if (result) {
              setDetectedLocality(result.locality);
              setDistanceKm(result.distanceKm);
              saveSelectedLocation(result.locality.name);
              resolve(result.locality);
            } else {
              resolve(null);
            }
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setStatus('denied');
              setErrorMsg('Location permission denied. You can manually choose any locality from the dropdown.');
            } else if (err.code === err.TIMEOUT) {
              setStatus('timeout');
              setErrorMsg('Location request timed out. Please select your locality manually.');
            } else {
              setStatus('error');
              setErrorMsg(err.message || 'Unable to retrieve location.');
            }
            resolve(null);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          }
        );
      });
    },
    []
  );

  return {
    status,
    errorMsg,
    coords,
    detectedLocality,
    distanceKm,
    detectLocation,
  };
}
