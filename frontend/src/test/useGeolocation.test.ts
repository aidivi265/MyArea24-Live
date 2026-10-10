import { describe, it, expect, beforeEach } from 'vitest';
import {
  findNearestLocality,
  getSavedLocation,
  saveSelectedLocation,
} from '../services/useGeolocation';
import type { LocalityOption } from '../types/intelligence';

const sampleLocalities: LocalityOption[] = [
  {
    id: 'delhi-connaught-place',
    name: 'Delhi Connaught Place',
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.6304,
    longitude: 77.2177,
    coverage_status: 'Active Pilot',
    is_live_supported: true,
  },
  {
    id: 'bengaluru-silk-board',
    name: 'Bengaluru Silk Board',
    city: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9176,
    longitude: 77.6233,
    coverage_status: 'Active Pilot',
    is_live_supported: true,
  },
  {
    id: 'mumbai-andheri-east',
    name: 'Mumbai Andheri East (WEH)',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.1136,
    longitude: 72.8697,
    coverage_status: 'Coverage Unavailable',
    is_live_supported: false,
  },
];

describe('useGeolocation & Location Utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly persists and retrieves selected location from localStorage', () => {
    expect(getSavedLocation()).toBeNull();

    saveSelectedLocation('Delhi Connaught Place');
    expect(getSavedLocation()).toBe('Delhi Connaught Place');

    saveSelectedLocation('');
    expect(getSavedLocation()).toBeNull();
  });

  it('correctly snaps coordinates near Delhi to Delhi Connaught Place', () => {
    // 28.62, 77.21 is very close to Connaught Place
    const result = findNearestLocality(28.6200, 77.2100, sampleLocalities);
    expect(result).not.toBeNull();
    expect(result?.locality.name).toBe('Delhi Connaught Place');
    expect(result?.distanceKm).toBeLessThan(5);
  });

  it('correctly snaps coordinates near Mumbai to Mumbai Andheri East', () => {
    // 19.10, 72.85 is in Mumbai
    const result = findNearestLocality(19.1000, 72.8500, sampleLocalities);
    expect(result).not.toBeNull();
    expect(result?.locality.name).toBe('Mumbai Andheri East (WEH)');
    expect(result?.locality.is_live_supported).toBe(false);
  });
});
