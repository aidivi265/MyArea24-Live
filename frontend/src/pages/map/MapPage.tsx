import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MapPin, Building2, Car, ShieldAlert, Wind, Layers,
  Radio, Navigation, CloudRain, Clock, AlertTriangle,
  ArrowRight, Search, X, Volume2, VolumeX, Compass,
  Phone, Share2, Play, Square, ChevronRight, ChevronLeft,
  Bike, Footprints, Train, LocateFixed, Eye, RotateCcw
} from 'lucide-react'
import { useLocationStore } from '@/store'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { businessApi, intelligenceApi, emergencyApi, locationApi } from '@/services/apiService'
import { getAQIInfo } from '@/utils'
import {
  fetchOsrmRoute, formatDistance, formatDuration, formatEta,
  speakManeuver, type ParsedRoute, type RouteStep
} from '@/utils/navigation'
import type { WeatherStatus, LocationResult } from '@/types'

// Dynamic Leaflet import
let L: typeof import('leaflet') | null = null

type TileStyleKey = 'streets' | 'satellite' | 'dark' | 'osm'

interface TileStyleConfig {
  name: string
  url: string
  attribution: string
  maxZoom: number
}

const TILE_STYLES: Record<TileStyleKey, TileStyleConfig> = {
  streets: {
    name: 'Detailed Streets',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '© CartoDB, © OpenStreetMap',
    maxZoom: 19,
  },
  satellite: {
    name: 'Satellite Photoreal',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  dark: {
    name: 'Night Drive',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© CartoDB, © OpenStreetMap',
    maxZoom: 19,
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
}

interface SelectedPlace {
  title: string
  subtitle?: string
  category: 'business' | 'hospital' | 'traffic' | 'hazard' | 'aqi' | 'custom'
  latitude: number
  longitude: number
  phone?: string
  details?: string
  distanceKm?: number
}

export default function MapPage() {
  const { selectedArea, selectedLat, selectedLon, setLocation } = useLocationStore()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<import('leaflet').Map | null>(null)
  const baseTileLayerRef = useRef<import('leaflet').TileLayer | null>(null)
  const centerCircleRef = useRef<import('leaflet').CircleMarker | null>(null)
  const currentNavMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const routePolylineBorderRef = useRef<import('leaflet').Polyline | null>(null)
  const routePolylineCoreRef = useRef<import('leaflet').Polyline | null>(null)
  const startMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const destMarkerRef = useRef<import('leaflet').Marker | null>(null)

  const layerGroupsRef = useRef<{
    businesses?: import('leaflet').LayerGroup
    traffic?: import('leaflet').LayerGroup
    emergency?: import('leaflet').LayerGroup
    aqi?: import('leaflet').LayerGroup
    community?: import('leaflet').LayerGroup
  }>({})

  // Map settings state
  const [tileStyle, setTileStyle] = useState<TileStyleKey>('streets')
  const [layers, setLayers] = useState({
    businesses: true,
    traffic: true,
    emergency: true,
    aqi: true,
    community: true,
  })
  const [counts, setCounts] = useState({
    businesses: 0,
    traffic: 0,
    emergency: 0,
    aqi: 0,
    community: 0,
  })
  const [weatherData, setWeatherData] = useState<WeatherStatus | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [layerPanelOpen, setLayerPanelOpen] = useState(false)
  const [tilePanelOpen, setTilePanelOpen] = useState(false)

  // Place inspection & Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LocationResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)

  // Navigation & Directions state
  const [navMode, setNavMode] = useState<'driving' | 'bike' | 'walking' | 'transit'>('driving')
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false)
  const [originName, setOriginName] = useState('My Location')
  const [destName, setDestName] = useState('')
  const [originCoords, setOriginCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [activeRoute, setActiveRoute] = useState<ParsedRoute | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [corridorRiskAdvisory, setCorridorRiskAdvisory] = useState<string | null>(null)

  // Live Navigation HUD state
  const [isNavigating, setIsNavigating] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSimulatingDrive, setIsSimulatingDrive] = useState(false)
  const [stepsDrawerOpen, setStepsDrawerOpen] = useState(false)

  const lat = selectedLat ?? 28.5672
  const lon = selectedLon ?? 77.2100

  // Update originCoords on lat/lon changes
  useEffect(() => {
    setOriginCoords({ lat, lon })
    setOriginName(selectedArea || 'My Location')
  }, [lat, lon, selectedArea])

  // Clear polyline layers from map
  const clearRouteOverlays = useCallback(() => {
    if (routePolylineBorderRef.current) {
      routePolylineBorderRef.current.remove()
      routePolylineBorderRef.current = null
    }
    if (routePolylineCoreRef.current) {
      routePolylineCoreRef.current.remove()
      routePolylineCoreRef.current = null
    }
    if (startMarkerRef.current) {
      startMarkerRef.current.remove()
      startMarkerRef.current = null
    }
    if (destMarkerRef.current) {
      destMarkerRef.current.remove()
      destMarkerRef.current = null
    }
    if (currentNavMarkerRef.current) {
      currentNavMarkerRef.current.remove()
      currentNavMarkerRef.current = null
    }
  }, [])

  // 1. Initialize Map
  useEffect(() => {
    let isMounted = true
    import('leaflet').then((leafletModule) => {
      if (!isMounted || !mapRef.current) return
      L = leafletModule

      if (!mapInstance.current) {
        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        const map = L.map(mapRef.current, { zoomControl: false }).setView([lat, lon], 13)
        mapInstance.current = map

        // Base Tile Layer
        const currentStyle = TILE_STYLES[tileStyle]
        baseTileLayerRef.current = L.tileLayer(currentStyle.url, {
          attribution: currentStyle.attribution,
          maxZoom: currentStyle.maxZoom,
        }).addTo(map)

        L.control.zoom({ position: 'bottomleft' }).addTo(map)

        // Initialize LayerGroups
        layerGroupsRef.current.businesses = L.layerGroup().addTo(map)
        layerGroupsRef.current.traffic = L.layerGroup().addTo(map)
        layerGroupsRef.current.emergency = L.layerGroup().addTo(map)
        layerGroupsRef.current.aqi = L.layerGroup().addTo(map)
        layerGroupsRef.current.community = L.layerGroup().addTo(map)

        // Center Location Pulsing Marker
        centerCircleRef.current = L.circleMarker([lat, lon], {
          radius: 10,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.6,
          weight: 3,
        }).addTo(map).bindPopup(`<strong>📍 ${selectedArea}</strong><br>Your Active Location Anchor`)

        // Click anywhere on map to select or set destination
        map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          const clickedLat = Number(e.latlng.lat.toFixed(5))
          const clickedLon = Number(e.latlng.lng.toFixed(5))
          setSelectedPlace({
            title: `Location (${clickedLat}, ${clickedLon})`,
            subtitle: 'Selected Point on Map',
            category: 'custom',
            latitude: clickedLat,
            longitude: clickedLon,
          })
        })
      }
    })

    return () => {
      isMounted = false
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // 2. Tile Style Switcher
  useEffect(() => {
    if (!mapInstance.current || !L) return
    if (baseTileLayerRef.current) {
      baseTileLayerRef.current.remove()
    }
    const currentStyle = TILE_STYLES[tileStyle]
    baseTileLayerRef.current = L.tileLayer(currentStyle.url, {
      attribution: currentStyle.attribution,
      maxZoom: currentStyle.maxZoom,
    }).addTo(mapInstance.current)
  }, [tileStyle])

  // 3. Pan map on lat/lon changes
  useEffect(() => {
    if (mapInstance.current && !isNavigating) {
      mapInstance.current.flyTo([lat, lon], 13, { duration: 1.0 })
      if (centerCircleRef.current) {
        centerCircleRef.current.setLatLng([lat, lon])
        centerCircleRef.current.setPopupContent(`<strong>📍 ${selectedArea}</strong><br>Your Active Location Anchor`)
      }
    }
  }, [lat, lon, selectedArea, isNavigating])

  // 4. Fetch Weather Telemetry
  useEffect(() => {
    intelligenceApi.weather({ area: selectedArea, lat, lon })
      .then(setWeatherData)
      .catch(() => {})
  }, [lat, lon, selectedArea])

  // 5. Populate Telemetry Layers
  useEffect(() => {
    if (!mapInstance.current || !L) return

    // --- Businesses ---
    if (layers.businesses && layerGroupsRef.current.businesses) {
      const group = layerGroupsRef.current.businesses
      group.clearLayers()
      businessApi.list({ user_lat: lat, user_lon: lon, page_size: 40 })
        .then(res => {
          setCounts(c => ({ ...c, businesses: res.items.length }))
          res.items.forEach(biz => {
            if (!biz.latitude || !biz.longitude || !L) return
            const icon = L.divIcon({
              html: `<div style="background:#1A5C38;width:30px;height:30px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:14px;cursor:pointer">🏪</div>`,
              className: '', iconSize: [30, 30], iconAnchor: [15, 15],
            })
            const marker = L.marker([biz.latitude, biz.longitude], { icon }).addTo(group)
            marker.on('click', () => {
              setSelectedPlace({
                title: biz.name,
                subtitle: `${biz.category} · ${biz.locality}`,
                category: 'business',
                latitude: biz.latitude!,
                longitude: biz.longitude!,
                phone: biz.phone,
                distanceKm: biz.distance_km,
              })
            })
          })
        })
        .catch(() => {})
    } else if (layerGroupsRef.current.businesses) {
      layerGroupsRef.current.businesses.clearLayers()
      setCounts(c => ({ ...c, businesses: 0 }))
    }

    // --- Traffic Bottlenecks ---
    if (layers.traffic && layerGroupsRef.current.traffic) {
      const group = layerGroupsRef.current.traffic
      group.clearLayers()
      intelligenceApi.traffic({ area: selectedArea, lat, lon, limit: 35 })
        .then(res => {
          const incidents = res.incidents ?? []
          setCounts(c => ({ ...c, traffic: incidents.length }))
          incidents.forEach(inc => {
            if (!inc.latitude || !inc.longitude || !L) return
            const color = inc.criticality === 'critical' ? '#ef4444' : inc.criticality === 'major' ? '#f97316' : '#eab308'
            const delayMin = inc.delay_seconds ? Math.round(inc.delay_seconds / 60) : 0
            const icon = L.divIcon({
              html: `<div style="background:${color};width:26px;height:26px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:12px;color:white;font-weight:bold">🚦</div>`,
              className: '', iconSize: [26, 26], iconAnchor: [13, 13],
            })
            const marker = L.marker([inc.latitude, inc.longitude], { icon }).addTo(group)
            marker.on('click', () => {
              setSelectedPlace({
                title: inc.road_name ? `Traffic on ${inc.road_name}` : `Congestion: ${inc.incident_type}`,
                subtitle: `${delayMin > 0 ? `+${delayMin} mins delay` : 'Slow Moving'} · TomTom Real-Time`,
                category: 'traffic',
                latitude: inc.latitude!,
                longitude: inc.longitude!,
                details: inc.description ?? 'Traffic bottleneck detected along this road.',
              })
            })
          })
        })
        .catch(() => {})
    } else if (layerGroupsRef.current.traffic) {
      layerGroupsRef.current.traffic.clearLayers()
      setCounts(c => ({ ...c, traffic: 0 }))
    }

    // --- Emergency & Trauma Facilities ---
    if (layers.emergency && layerGroupsRef.current.emergency) {
      const group = layerGroupsRef.current.emergency
      group.clearLayers()
      emergencyApi.facilities({ latitude: lat, longitude: lon, limit: 25 })
        .then(res => {
          const facs = res.facilities ?? []
          setCounts(c => ({ ...c, emergency: facs.length }))
          facs.forEach(f => {
            if (!f.latitude || !f.longitude || !L) return
            const icon = L.divIcon({
              html: `<div style="background:#dc2626;width:28px;height:28px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:13px;color:white">🏥</div>`,
              className: '', iconSize: [28, 28], iconAnchor: [14, 14],
            })
            const marker = L.marker([f.latitude, f.longitude], { icon }).addTo(group)
            marker.on('click', () => {
              setSelectedPlace({
                title: f.name,
                subtitle: `${f.locality || f.city} · ${f.is_24_7 ? '24/7 Casualty Open' : 'Hospital'}`,
                category: 'hospital',
                latitude: f.latitude!,
                longitude: f.longitude!,
                phone: f.phone,
                distanceKm: f.distance_km,
                details: f.blood_bank_available ? 'Blood Bank & Trauma Facilities Verified' : undefined,
              })
            })
          })
        })
        .catch(() => {})
    } else if (layerGroupsRef.current.emergency) {
      layerGroupsRef.current.emergency.clearLayers()
      setCounts(c => ({ ...c, emergency: 0 }))
    }

    // --- AQI Stations ---
    if (layers.aqi && layerGroupsRef.current.aqi) {
      const group = layerGroupsRef.current.aqi
      group.clearLayers()
      intelligenceApi.airQuality({ area: selectedArea, lat, lon })
        .then(res => {
          if (res.is_available && res.aqi_value !== undefined && L) {
            setCounts(c => ({ ...c, aqi: 1 }))
            const aqiInfo = getAQIInfo(res.aqi_value)
            const icon = L.divIcon({
              html: `<div style="background:${aqiInfo.color};width:34px;height:34px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:11px;color:white;font-weight:bold">${Math.round(res.aqi_value)}</div>`,
              className: '', iconSize: [34, 34], iconAnchor: [17, 17],
            })
            const stLat = lat + 0.005
            const stLon = lon + 0.005
            const marker = L.marker([stLat, stLon], { icon }).addTo(group)
            marker.on('click', () => {
              setSelectedPlace({
                title: res.station_name ?? 'CAAQMS Air Quality Monitor',
                subtitle: `AQI ${res.aqi_value} (${res.aqi_category})`,
                category: 'aqi',
                latitude: stLat,
                longitude: stLon,
                details: `PM2.5: ${res.pm25 ?? 'N/A'} µg/m³ · Prominent: ${res.prominent_pollutant ?? 'PM2.5'}`,
              })
            })
          } else {
            setCounts(c => ({ ...c, aqi: 0 }))
          }
        })
        .catch(() => {})
    } else if (layerGroupsRef.current.aqi) {
      layerGroupsRef.current.aqi.clearLayers()
      setCounts(c => ({ ...c, aqi: 0 }))
    }

    // --- Community Signal Hazard Mesh ---
    if (layers.community && layerGroupsRef.current.community) {
      const group = layerGroupsRef.current.community
      group.clearLayers()
      intelligenceApi.communitySignals({ area: selectedArea, lat, lon, limit: 30 })
        .then(signals => {
          setCounts(c => ({ ...c, community: signals.length }))
          signals.forEach(sig => {
            if (!sig.latitude || !sig.longitude || !L) return
            const emoji = sig.signal_type.toUpperCase().includes('WATER') ? '💧'
              : sig.signal_type.toUpperCase().includes('BLOCK') ? '🚧'
              : sig.signal_type.toUpperCase().includes('ACCIDENT') ? '💥' : '⚠️'
            const icon = L.divIcon({
              html: `<div style="background:#f59e0b;width:30px;height:30px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:14px">${emoji}</div>`,
              className: '', iconSize: [30, 30], iconAnchor: [15, 15],
            })
            const marker = L.marker([sig.latitude, sig.longitude], { icon }).addTo(group)
            marker.on('click', () => {
              setSelectedPlace({
                title: sig.title,
                subtitle: `${emoji} ${sig.signal_type} · ${sig.upvotes} Confirmations`,
                category: 'hazard',
                latitude: sig.latitude,
                longitude: sig.longitude,
                details: sig.description,
              })
            })
          })
        })
        .catch(() => {})
    } else if (layerGroupsRef.current.community) {
      layerGroupsRef.current.community.clearLayers()
      setCounts(c => ({ ...c, community: 0 }))
    }
  }, [layers, lat, lon, selectedArea])

  // 6. Handle Search Input
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      setIsSearching(true)
      locationApi.search(searchQuery.trim())
        .then(res => setSearchResults(res || []))
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false))
    }, 280)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Select Search Item
  function handleSelectSearchResult(item: LocationResult) {
    const itemLat = item.latitude ?? item.lat ?? 28.5672
    const itemLon = item.longitude ?? item.lon ?? 77.2100
    setSearchQuery('')
    setSearchResults([])
    if (mapInstance.current) {
      mapInstance.current.flyTo([itemLat, itemLon], 15, { duration: 1.2 })
    }
    setSelectedPlace({
      title: item.name,
      subtitle: `${item.district || item.city || ''}, ${item.state || ''}`,
      category: 'custom',
      latitude: itemLat,
      longitude: itemLon,
    })
  }

  // 7. Calculate & Plot Route between Origin & Destination
  const computeRoute = useCallback(async (
    orig: { lat: number; lon: number },
    dest: { lat: number; lon: number },
    mode: 'driving' | 'bike' | 'walking' | 'transit'
  ) => {
    setRouteLoading(true)
    clearRouteOverlays()

    try {
      const route = await fetchOsrmRoute(orig.lat, orig.lon, dest.lat, dest.lon, mode)
      setActiveRoute(route)
      setActiveStepIndex(0)

      if (mapInstance.current && L) {
        // Shadow / Outer line for clarity
        routePolylineBorderRef.current = L.polyline(route.coordinates, {
          color: '#1e3a8a',
          weight: 8,
          opacity: 0.5,
          lineJoin: 'round',
        }).addTo(mapInstance.current)

        // Core Route Polyline
        routePolylineCoreRef.current = L.polyline(route.coordinates, {
          color: mode === 'walking' ? '#059669' : '#2563eb',
          weight: 5,
          opacity: 0.95,
          lineJoin: 'round',
        }).addTo(mapInstance.current)

        // Start Pin (Green)
        const startIcon = L.divIcon({
          html: `<div style="background:#16a34a;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold">A</div>`,
          className: '', iconSize: [24, 24], iconAnchor: [12, 12],
        })
        startMarkerRef.current = L.marker([orig.lat, orig.lon], { icon: startIcon }).addTo(mapInstance.current)

        // Destination Pin (Red Flag)
        const destIcon = L.divIcon({
          html: `<div style="background:#dc2626;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold">B</div>`,
          className: '', iconSize: [24, 24], iconAnchor: [12, 12],
        })
        destMarkerRef.current = L.marker([dest.lat, dest.lon], { icon: destIcon }).addTo(mapInstance.current)

        // Fit map bounds to show complete corridor
        mapInstance.current.fitBounds(routePolylineBorderRef.current.getBounds(), {
          padding: [60, 60],
          maxZoom: 16,
        })
      }

      // Check parallel local risk assessment from backend
      intelligenceApi.routesEvaluate({
        origin_name: originName || 'Origin Point',
        origin_latitude: orig.lat,
        origin_longitude: orig.lon,
        destination_name: destName || 'Destination Point',
        destination_latitude: dest.lat,
        destination_longitude: dest.lon,
      }).then(evalRes => {
        setCorridorRiskAdvisory(evalRes.ai_commute_advisory || null)
      }).catch(() => {
        setCorridorRiskAdvisory(null)
      })

    } catch {
      alert('Could not compute road directions for the chosen points. Please try again.')
    } finally {
      setRouteLoading(false)
    }
  }, [clearRouteOverlays, originName, destName])

  // Trigger routing when destination or mode changes
  const startDirectionsTo = (place: SelectedPlace) => {
    const orig = originCoords ?? { lat, lon }
    const dest = { lat: place.latitude, lon: place.longitude }
    setDestCoords(dest)
    setDestName(place.title)
    setIsDirectionsOpen(true)
    setSelectedPlace(null)
    computeRoute(orig, dest, navMode)
  }

  // Handle travel mode switch
  const handleModeChange = (mode: 'driving' | 'bike' | 'walking' | 'transit') => {
    setNavMode(mode)
    if (originCoords && destCoords) {
      computeRoute(originCoords, destCoords, mode)
    }
  }

  // Reverse / Swap Origin & Destination
  const handleSwapPoints = () => {
    if (!originCoords || !destCoords) return
    const newOrig = { ...destCoords }
    const newDest = { ...originCoords }
    const newOrigName = destName
    const newDestName = originName
    setOriginCoords(newOrig)
    setDestCoords(newDest)
    setOriginName(newOrigName)
    setDestName(newDestName)
    computeRoute(newOrig, newDest, navMode)
  }

  // 8. Live Turn-by-Turn Navigation Control
  const startLiveNavigation = () => {
    if (!activeRoute || activeRoute.steps.length === 0) return
    setIsNavigating(true)
    setActiveStepIndex(0)
    setIsDirectionsOpen(false)

    // Pan to first step
    const firstStep = activeRoute.steps[0]
    if (mapInstance.current && L) {
      mapInstance.current.flyTo(firstStep.location, 16, { duration: 1.0 })
      updateNavCursor(firstStep.location)
    }

    if (voiceEnabled) {
      speakManeuver(firstStep.instruction)
    }
  }

  const exitLiveNavigation = () => {
    setIsNavigating(false)
    setIsSimulatingDrive(false)
    if (currentNavMarkerRef.current) {
      currentNavMarkerRef.current.remove()
      currentNavMarkerRef.current = null
    }
    if (routePolylineBorderRef.current && mapInstance.current) {
      mapInstance.current.fitBounds(routePolylineBorderRef.current.getBounds(), { padding: [50, 50] })
    }
  }

  // Update animated cursor marker at step location
  const updateNavCursor = (loc: [number, number]) => {
    if (!mapInstance.current || !L) return
    if (currentNavMarkerRef.current) {
      currentNavMarkerRef.current.setLatLng(loc)
    } else {
      const cursorIcon = L.divIcon({
        html: `<div style="background:#2563eb;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 0 16px rgba(37,99,235,0.8);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;animation:pulse 1.5s infinite">▲</div>`,
        className: '', iconSize: [28, 28], iconAnchor: [14, 14],
      })
      currentNavMarkerRef.current = L.marker(loc, { icon: cursorIcon }).addTo(mapInstance.current)
    }
  }

  // Step next/prev during navigation
  const goToNavStep = (stepIdx: number) => {
    if (!activeRoute) return
    const maxIdx = activeRoute.steps.length - 1
    const targetIdx = Math.max(0, Math.min(stepIdx, maxIdx))
    setActiveStepIndex(targetIdx)
    const step = activeRoute.steps[targetIdx]

    if (mapInstance.current) {
      mapInstance.current.flyTo(step.location, 16, { duration: 0.8 })
      updateNavCursor(step.location)
    }

    if (voiceEnabled) {
      speakManeuver(step.instruction)
    }
  }

  // Auto-drive simulation loop
  useEffect(() => {
    if (!isSimulatingDrive || !isNavigating || !activeRoute) return
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev >= activeRoute.steps.length - 1) {
          setIsSimulatingDrive(false)
          return prev
        }
        const next = prev + 1
        const step = activeRoute.steps[next]
        if (mapInstance.current) {
          mapInstance.current.flyTo(step.location, 16, { duration: 0.8 })
          updateNavCursor(step.location)
        }
        if (voiceEnabled) {
          speakManeuver(step.instruction)
        }
        return next
      })
    }, 4500)

    return () => clearInterval(interval)
  }, [isSimulatingDrive, isNavigating, activeRoute, voiceEnabled])

  // Locate Me GPS
  function locateMe() {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        mapInstance.current?.flyTo([latitude, longitude], 15, { duration: 1.0 })
        setOriginCoords({ lat: latitude, lon: longitude })
        try {
          const geo = await locationApi.detect(latitude, longitude)
          const areaLabel = geo.short_label || geo.display_label || geo.town || geo.district || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          setLocation(areaLabel, latitude, longitude, {
            city: geo.town || geo.district || '',
            state: geo.state || '',
            district: geo.district || '',
            village: geo.village || '',
            tehsil: geo.tehsil || '',
            pincode: geo.pincode || '',
            accuracy: geo.accuracy || 'exact',
            rawAddress: geo.display_label || areaLabel,
          })
          setOriginName(areaLabel)
        } catch {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, latitude, longitude)
          setOriginName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        }
        setGpsLoading(false)
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true }
    )
  }

  const activeStep: RouteStep | undefined = activeRoute?.steps[activeStepIndex]
  const nextStep: RouteStep | undefined = activeRoute?.steps[activeStepIndex + 1]

  return (
    <>
      <SEOMeta
        title={`Live Map & Turn-by-Turn Navigation — ${selectedArea}`}
        description="Comprehensive pan-India interactive map with real-time turn-by-turn routing, TomTom traffic, 24/7 hospitals, CPCB air quality, and hazard telemetry."
      />

      <div className="relative -mx-4 -my-6 h-[calc(100vh-3.5rem)] overflow-hidden font-sans select-none">
        {/* Leaflet Map Canvas */}
        <div ref={mapRef} className="w-full h-full z-0" />

        {/* ─── 1. TOP BAR: SEARCH & DISCOVERY CHIPS (When not in full navigation HUD) ─── */}
        {!isNavigating && (
          <div className="absolute top-3 left-3 right-3 sm:left-4 sm:right-auto sm:w-96 z-[1000] space-y-2">
            {/* Search Input Box */}
            <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 flex items-center px-3.5 py-2.5 transition-all focus-within:ring-2 focus-within:ring-brand-500">
              <Search className="h-4 w-4 text-gray-400 mr-2.5 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search places, hospitals, addresses in India…"
                className="w-full text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 text-gray-400 hover:text-gray-600 mr-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsDirectionsOpen((o) => !o)}
                title="Directions / Route Planner"
                className={`p-1.5 rounded-xl transition-colors flex-shrink-0 ${
                  isDirectionsOpen ? 'bg-brand-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Navigation className="h-4 w-4" />
              </button>
            </div>

            {/* Instant Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 max-h-64 overflow-y-auto space-y-1 animate-in fade-in slide-in-from-top-1">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSearchResult(item)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-gray-50 flex items-start gap-2.5 text-xs text-gray-700 transition"
                  >
                    <MapPin className="h-4 w-4 text-brand-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 truncate">
                      <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {item.district || item.city || ''}{item.state ? `, ${item.state}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Quick Category Discovery Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => setLayers(l => ({ ...l, emergency: true }))}
                className="px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur shadow-md border border-gray-100 text-xs font-semibold text-red-600 flex items-center gap-1 whitespace-nowrap hover:bg-red-50 transition"
              >
                <ShieldAlert className="h-3.5 w-3.5" /> Hospitals
              </button>
              <button
                onClick={() => setLayers(l => ({ ...l, traffic: true }))}
                className="px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur shadow-md border border-gray-100 text-xs font-semibold text-orange-600 flex items-center gap-1 whitespace-nowrap hover:bg-orange-50 transition"
              >
                <Car className="h-3.5 w-3.5" /> Traffic
              </button>
              <button
                onClick={() => setLayers(l => ({ ...l, community: true }))}
                className="px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur shadow-md border border-gray-100 text-xs font-semibold text-amber-600 flex items-center gap-1 whitespace-nowrap hover:bg-amber-50 transition"
              >
                <Radio className="h-3.5 w-3.5" /> Hazards
              </button>
              <button
                onClick={() => setLayers(l => ({ ...l, businesses: true }))}
                className="px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur shadow-md border border-gray-100 text-xs font-semibold text-brand-700 flex items-center gap-1 whitespace-nowrap hover:bg-emerald-50 transition"
              >
                <Building2 className="h-3.5 w-3.5" /> Shops
              </button>
              <button
                onClick={() => setLayers(l => ({ ...l, aqi: true }))}
                className="px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur shadow-md border border-gray-100 text-xs font-semibold text-emerald-600 flex items-center gap-1 whitespace-nowrap hover:bg-emerald-50 transition"
              >
                <Wind className="h-3.5 w-3.5" /> AQI
              </button>
            </div>
          </div>
        )}

        {/* ─── 2. TOP RIGHT: WEATHER TELEMETRY WIDGET ─── */}
        {!isNavigating && weatherData && (
          <div className="hidden sm:flex absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl p-3 items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <CloudRain className="h-5 w-5" />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-1.5 font-bold text-gray-800">
                <span>{weatherData.temperature_c ?? 28}°C</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-600 truncate">{weatherData.condition_text ?? 'Clear'}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                {weatherData.waterlogging_risk_index && weatherData.waterlogging_risk_index > 0 ? (
                  <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                    <AlertTriangle className="h-3 w-3" /> Flood Risk: {Math.min(100, weatherData.waterlogging_risk_index * 10).toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium">Dry Surface</span>
                )}
                {weatherData.transit_delay_estimate_min ? (
                  <span className="text-red-500 font-semibold flex items-center gap-0.5">
                    <Clock className="h-3 w-3" /> +{weatherData.transit_delay_estimate_min}m
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ─── 3. DIRECTIONS / ROUTE PLANNER PANEL ─── */}
        {isDirectionsOpen && !isNavigating && (
          <div className="absolute top-16 left-3 right-3 sm:left-4 sm:right-auto sm:w-96 z-[1000] bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-brand-600" />
                <h3 className="font-bold text-sm text-gray-800">Get Directions</h3>
              </div>
              <button
                onClick={() => { setIsDirectionsOpen(false); clearRouteOverlays(); setActiveRoute(null) }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Travel Mode Pills */}
            <div className="flex items-center justify-between bg-gray-50 p-1 rounded-2xl border border-gray-100 text-xs font-semibold">
              <button
                onClick={() => handleModeChange('driving')}
                className={`flex-1 py-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                  navMode === 'driving' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Car className="h-3.5 w-3.5" /> Drive
              </button>
              <button
                onClick={() => handleModeChange('bike')}
                className={`flex-1 py-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                  navMode === 'bike' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Bike className="h-3.5 w-3.5" /> Bike
              </button>
              <button
                onClick={() => handleModeChange('walking')}
                className={`flex-1 py-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                  navMode === 'walking' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Footprints className="h-3.5 w-3.5" /> Walk
              </button>
              <button
                onClick={() => handleModeChange('transit')}
                className={`flex-1 py-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                  navMode === 'transit' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Train className="h-3.5 w-3.5" /> Metro
              </button>
            </div>

            {/* Origin & Destination Inputs with Swap */}
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <input
                    value={originName}
                    onChange={(e) => setOriginName(e.target.value)}
                    placeholder="Starting point..."
                    className="w-full bg-transparent outline-none font-medium text-gray-800"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0" />
                  <input
                    value={destName}
                    onChange={(e) => setDestName(e.target.value)}
                    placeholder="Enter destination or click on map..."
                    className="w-full bg-transparent outline-none font-medium text-gray-800"
                  />
                </div>
              </div>
              <button
                onClick={handleSwapPoints}
                title="Swap Start and Destination"
                className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            {/* Route Computation Result & Start Nav Button */}
            {routeLoading && (
              <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded-2xl flex items-center justify-center gap-2">
                <span className="h-3 w-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                Calculating optimal corridor…
              </div>
            )}

            {activeRoute && !routeLoading && (
              <div className="space-y-3 pt-1">
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-emerald-800">
                        {formatDuration(activeRoute.totalDurationSeconds)}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600">
                        ({formatDistance(activeRoute.totalDistanceMeters)})
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      ETA: {formatEta(activeRoute.totalDurationSeconds)} · {activeRoute.summary}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-xl">
                    Fastest
                  </span>
                </div>

                {corridorRiskAdvisory && (
                  <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-700 leading-relaxed">
                    <strong>Local Safety Advice:</strong> {corridorRiskAdvisory}
                  </div>
                )}

                <button
                  onClick={startLiveNavigation}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-brand-600 hover:from-emerald-700 hover:to-brand-700 text-white font-bold text-sm rounded-2xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition hover:scale-[1.02]"
                >
                  <Navigation className="h-4 w-4 fill-white" />
                  <span>Start Navigation (नेविगेशन शुरू करें)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── 4. CLICKED PLACE INSPECTION CARD (Bottom Sheet) ─── */}
        {selectedPlace && !isNavigating && !isDirectionsOpen && (
          <div className="absolute bottom-4 left-3 right-3 sm:left-4 sm:right-auto sm:w-96 z-[1000] bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0 text-lg">
                  {selectedPlace.category === 'hospital' ? '🏥'
                    : selectedPlace.category === 'traffic' ? '🚦'
                    : selectedPlace.category === 'hazard' ? '⚠️'
                    : selectedPlace.category === 'aqi' ? '🍃'
                    : selectedPlace.category === 'business' ? '🏪' : '📍'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 leading-tight">{selectedPlace.title}</h4>
                  {selectedPlace.subtitle && (
                    <p className="text-xs text-gray-500 mt-0.5">{selectedPlace.subtitle}</p>
                  )}
                  {selectedPlace.distanceKm !== undefined && (
                    <span className="text-[11px] font-semibold text-brand-600 mt-0.5 inline-block">
                      {selectedPlace.distanceKm.toFixed(1)} km away
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedPlace(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedPlace.details && (
              <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-xl">
                {selectedPlace.details}
              </p>
            )}

            {/* Actions: Directions & Call */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => startDirectionsTo(selectedPlace)}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Directions (नेविगेट)</span>
              </button>
              {selectedPlace.phone && (
                <a
                  href={`tel:${selectedPlace.phone}`}
                  className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Phone className="h-3.5 w-3.5 text-brand-600" />
                  <span>Call</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ─── 5. FULL GOOGLE MAPS STYLE LIVE NAVIGATION HUD ─── */}
        {isNavigating && activeStep && (
          <>
            {/* Top Navigation Banner */}
            <div className="absolute top-3 left-3 right-3 sm:left-6 sm:right-6 max-w-xl mx-auto z-[1100] bg-emerald-800 text-white rounded-3xl shadow-2xl p-4 sm:p-5 border border-emerald-700/60 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white flex-shrink-0 text-2xl shadow-inner font-bold">
                  {activeStep.maneuverType === 'arrive' ? '🏁'
                    : activeStep.modifier === 'left' ? '⬅️'
                    : activeStep.modifier === 'right' ? '➡️'
                    : activeStep.modifier === 'slight left' ? '↖️'
                    : activeStep.modifier === 'slight right' ? '↗️'
                    : activeStep.modifier === 'uturn' ? '↩️' : '⬆️'}
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wider font-bold text-emerald-200">
                    In {formatDistance(activeStep.distance)}
                  </div>
                  <h2 className="text-base sm:text-lg font-black leading-tight mt-0.5">
                    {activeStep.instruction}
                  </h2>
                  {nextStep && (
                    <p className="text-xs text-emerald-300 mt-1 truncate">
                      Then {nextStep.instruction}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setVoiceEnabled(v => !v)}
                  title={voiceEnabled ? 'Mute Voice' : 'Unmute Voice'}
                  className={`p-2 rounded-2xl transition ${
                    voiceEnabled ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Bottom Navigation Control Bar */}
            <div className="absolute bottom-4 left-3 right-3 sm:left-6 sm:right-6 max-w-xl mx-auto z-[1100] bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-900">
                      {activeRoute ? formatDuration(activeRoute.totalDurationSeconds) : '0 min'}
                    </span>
                    <span className="text-xs font-bold text-gray-500">
                      {activeRoute ? formatDistance(activeRoute.totalDistanceMeters) : '0 km'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 font-medium">
                    Expected Arrival: {activeRoute ? formatEta(activeRoute.totalDurationSeconds) : '--:--'}
                  </div>
                </div>

                {/* Simulation Drive Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => goToNavStep(activeStepIndex - 1)}
                    disabled={activeStepIndex === 0}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40"
                    title="Previous Turn"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIsSimulatingDrive(s => !s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                      isSimulatingDrive
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    }`}
                  >
                    {isSimulatingDrive ? <Square className="h-3 w-3 fill-amber-800" /> : <Play className="h-3 w-3 fill-brand-700" />}
                    <span>{isSimulatingDrive ? 'Pause' : 'Simulate'}</span>
                  </button>
                  <button
                    onClick={() => goToNavStep(activeStepIndex + 1)}
                    disabled={!activeRoute || activeStepIndex >= activeRoute.steps.length - 1}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40"
                    title="Next Turn"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setStepsDrawerOpen(o => !o)}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                    title="Show Full Turn Itinerary"
                  >
                    <Layers className="h-4 w-4" />
                  </button>
                  <button
                    onClick={exitLiveNavigation}
                    className="p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 font-bold"
                    title="Exit Navigation"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Turn-by-Turn Steps Drawer Accordion */}
              {stepsDrawerOpen && activeRoute && (
                <div className="max-h-60 overflow-y-auto space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                  {activeRoute.steps.map((st, sidx) => (
                    <button
                      key={sidx}
                      onClick={() => { goToNavStep(sidx); setStepsDrawerOpen(false) }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition ${
                        sidx === activeStepIndex ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className="truncate pr-2">{sidx + 1}. {st.instruction}</span>
                      <span className="text-[11px] text-gray-400 font-mono flex-shrink-0">{formatDistance(st.distance)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── 6. FLOATING MAP CONTROLS (Right & Left) ─── */}
        {!isNavigating && (
          <>
            {/* Bottom-Left: Map Layer & Style Controls */}
            <div className="absolute bottom-6 left-3 z-[1000] flex flex-col gap-2">
              {/* Tile Style Picker */}
              <button
                onClick={() => setTilePanelOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white shadow-xl border border-gray-100 text-xs font-bold text-gray-800 hover:bg-gray-50 transition"
              >
                <Compass className="h-4 w-4 text-brand-600" />
                <span>Map Style: {TILE_STYLES[tileStyle].name}</span>
              </button>

              {tilePanelOpen && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-2 w-48 space-y-1 animate-in fade-in slide-in-from-bottom-2">
                  {(Object.keys(TILE_STYLES) as TileStyleKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setTileStyle(key); setTilePanelOpen(false) }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        tileStyle === key ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {TILE_STYLES[key].name}
                    </button>
                  ))}
                </div>
              )}

              {/* Telemetry Layers Toggle */}
              <button
                onClick={() => setLayerPanelOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white shadow-xl border border-gray-100 text-xs font-bold text-gray-800 hover:bg-gray-50 transition"
              >
                <Layers className="h-4 w-4 text-emerald-600" />
                <span>Layers ({Object.values(layers).filter(Boolean).length})</span>
              </button>

              {layerPanelOpen && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-3.5 space-y-2 w-56 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                    <span className="text-[11px] font-bold uppercase text-gray-400">Live Telemetry</span>
                    <button
                      onClick={() => setLayers({ businesses: true, traffic: true, emergency: true, aqi: true, community: true })}
                      className="text-[10px] text-brand-600 font-bold hover:underline"
                    >
                      Enable All
                    </button>
                  </div>
                  {[
                    { key: 'traffic' as const, label: 'Traffic Bottlenecks', count: counts.traffic, color: 'text-orange-500' },
                    { key: 'community' as const, label: 'Citizen Hazards', count: counts.community, color: 'text-amber-500' },
                    { key: 'emergency' as const, label: '24/7 Hospitals', count: counts.emergency, color: 'text-red-500' },
                    { key: 'businesses' as const, label: 'Verified Stores', count: counts.businesses, color: 'text-brand-500' },
                    { key: 'aqi' as const, label: 'CPCB AQI Station', count: counts.aqi, color: 'text-emerald-500' },
                  ].map(({ key, label, count, color }) => (
                    <label key={key} className="flex items-center justify-between text-xs text-gray-700 cursor-pointer p-1 rounded-lg hover:bg-gray-50">
                      <span className={`font-medium ${color}`}>{label}</span>
                      <div className="flex items-center gap-1.5">
                        {count > 0 && <span className="text-[10px] text-gray-400">({count})</span>}
                        <input
                          type="checkbox"
                          checked={layers[key]}
                          onChange={(e) => setLayers(l => ({ ...l, [key]: e.target.checked }))}
                          className="accent-brand-600 h-3.5 w-3.5 rounded cursor-pointer"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom-Right: Locate Me GPS Button */}
            <div className="absolute bottom-6 right-3 z-[1000] flex flex-col gap-2">
              <button
                onClick={locateMe}
                disabled={gpsLoading}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white shadow-2xl font-bold text-xs transition-all hover:scale-105 disabled:opacity-60"
              >
                <LocateFixed className="h-4 w-4" />
                <span>{gpsLoading ? 'Detecting GPS…' : 'My Location'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
