import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ShieldAlert,
  MapPin,
  Phone,
  Heart,
  Droplets,
  Navigation,
  Train,
  UserCheck,
  AlertOctagon,
  Share2,
  LifeBuoy,
  Radio,
  Flame,
} from 'lucide-react'
import { emergencyApi, locationApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { formatDistance } from '@/utils'
import { motion } from 'framer-motion'

export default function EmergencyPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedLat, selectedLon, setLocation } = useLocationStore()
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [isCrisisMode, setIsCrisisMode] = useState(false)
  const [filterType, setFilterType] = useState<'ALL' | 'TRAUMA' | 'BLOOD_BANK'>('ALL')
  const [sosShared, setSosShared] = useState(false)

  const EMERGENCY_NUMBERS = [
    { label: t('emergency.police_sos'), number: '112', color: 'bg-red-500', icon: <ShieldAlert className="h-6 w-6" /> },
    { label: t('emergency.ambulance'), number: '108', color: 'bg-orange-500', icon: <Heart className="h-6 w-6" /> },
    { label: t('emergency.nhai_sos'), number: '1033', color: 'bg-indigo-600', icon: <Navigation className="h-6 w-6" /> },
    { label: t('emergency.railway_helpline'), number: '139', color: 'bg-emerald-600', icon: <Train className="h-6 w-6" /> },
    { label: t('emergency.fire'), number: '101', color: 'bg-amber-500', icon: <Flame className="h-6 w-6" /> },
    { label: t('emergency.women_helpline'), number: '1091', color: 'bg-purple-600', icon: <UserCheck className="h-6 w-6" /> },
  ]

  const lat = gpsCoords?.lat ?? selectedLat ?? undefined
  const lon = gpsCoords?.lon ?? selectedLon ?? undefined

  const { data, isLoading } = useQuery({
    queryKey: ['emergency', lat, lon, selectedArea, filterType],
    queryFn: () =>
      emergencyApi.facilities({
        city: selectedArea,
        latitude: lat,
        longitude: lon,
        blood_bank_only: filterType === 'BLOOD_BANK',
        limit: 25,
      }),
    staleTime: 30 * 60 * 1000,
  })

  async function locateMe() {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        setGpsCoords({ lat, lon })
        localStorage.setItem('ma24_location_manually_set', 'true')
        try {
          const detected = await locationApi.detect(lat, lon)
          const areaName = detected.short_label || detected.display_label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`
          const cityName = detected.town || detected.district || areaName.split(',')[0].trim()
          setLocation(areaName, lat, lon, {
            city: cityName,
            state: detected.state,
            district: detected.district,
            village: detected.village,
            tehsil: detected.tehsil,
            pincode: detected.pincode,
            accuracy: detected.accuracy || 'exact',
            rawAddress: detected.display_label || areaName,
          })
        } catch {
          setLocation('My Location (GPS)', lat, lon)
        } finally {
          setGpsLoading(false)
        }
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleShareSOS = () => {
    const locText = lat && lon ? `https://maps.google.com/?q=${lat},${lon}` : selectedArea
    const message = `🚨 EMERGENCY SOS ALERT! I require urgent assistance near ${selectedArea || 'my location'}. Live GPS coordinates: ${locText}. Please dispatch emergency response.`
    if (navigator.share) {
      navigator.share({ title: 'MyArea24 Emergency SOS', text: message }).catch(() => {})
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    }
    setSosShared(true)
    setTimeout(() => setSosShared(false), 4000)
  }

  const facilities = (data?.facilities ?? []).filter(f => {
    if (filterType === 'TRAUMA') return f.trauma_level || f.is_24_7
    return true
  })

  return (
    <>
      <SEOMeta
        title={`${t('emergency.title')} — ${selectedArea}`}
        description={`Verified hospitals, trauma centers, blood banks, NHAI Highway SOS and disaster crisis desks in ${selectedArea}`}
      />
      <div className="space-y-6">
        {/* Header with Crisis Mode Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6" />{t('emergency.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('emergency.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCrisisMode(m => !m)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                isCrisisMode
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }`}
            >
              <AlertOctagon className="h-4 w-4" />
              {isCrisisMode ? t('emergency.red_alert_on') : t('emergency.activate_red_alert')}
            </button>

            <button
              onClick={handleShareSOS}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition"
            >
              <Share2 className="h-3.5 w-3.5" />
              {sosShared ? t('emergency.sos_broadcasted') : t('emergency.share_sos')}
            </button>
          </div>
        </div>

        {/* Disaster / Red Alert Coordination Protocol (Slide 08) */}
        {isCrisisMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-red-600 via-rose-700 to-red-900 text-white rounded-2xl p-5 shadow-lg space-y-4 border border-red-400"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 animate-spin" />
                <h2 className="font-black text-base tracking-wide uppercase">
                  {t('emergency.disaster_desks_title')}
                </h2>
              </div>
              <span className="text-[11px] bg-white/20 font-bold px-2.5 py-0.5 rounded-full">
                {t('emergency.active_red_protocol')}
              </span>
            </div>

            <p className="text-xs text-red-100 leading-relaxed">
              {t('emergency.disaster_desks_desc')}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <a
                href="tel:1078"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/20 transition flex flex-col items-center text-center"
              >
                <LifeBuoy className="h-5 w-5 text-amber-300 mb-1" />
                <span className="text-xl font-black">1078</span>
                <span className="text-[10px] font-bold text-red-100">NDMA National Crisis</span>
              </a>

              <a
                href="tel:1070"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/20 transition flex flex-col items-center text-center"
              >
                <ShieldAlert className="h-5 w-5 text-yellow-300 mb-1" />
                <span className="text-xl font-black">1070</span>
                <span className="text-[10px] font-bold text-red-100">SDMA State Disaster Cell</span>
              </a>

              <a
                href="tel:1077"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/20 transition flex flex-col items-center text-center"
              >
                <MapPin className="h-5 w-5 text-emerald-300 mb-1" />
                <span className="text-xl font-black">1077</span>
                <span className="text-[10px] font-bold text-red-100">District Emergency (DEOC)</span>
              </a>

              <a
                href="tel:1554"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/20 transition flex flex-col items-center text-center"
              >
                <Droplets className="h-5 w-5 text-blue-300 mb-1" />
                <span className="text-xl font-black">1554</span>
                <span className="text-[10px] font-bold text-red-100">Flood & Coast Rescue</span>
              </a>
            </div>
          </motion.div>
        )}

        {/* Emergency Numbers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {EMERGENCY_NUMBERS.map(({ label, number, color, icon }) => (
            <motion.a
              key={number}
              href={`tel:${number}`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`${color} text-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-md hover:shadow-lg transition-shadow`}
            >
              {icon}
              <span className="text-2xl font-black">{number}</span>
              <span className="text-xs font-semibold text-center">{label}</span>
            </motion.a>
          ))}
        </div>

        {/* National Highway & Expressway Safety Desks (NHAI 1033) */}
        {(data?.expressway_emergency_desks?.length ?? 0) > 0 && (
          <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 rounded-2xl border border-indigo-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Navigation className="h-4 w-4 text-indigo-600" />
                {t('emergency.nhai_desks_title')}
              </h2>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                {t('emergency.pan_india_24x7')}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data?.expressway_emergency_desks?.map(desk => (
                <div key={desk.name} className="bg-white rounded-xl border border-indigo-100/80 p-3 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-xs">{desk.name}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">{desk.route}</p>
                  </div>
                  <a
                    href={`tel:${desk.phone.replace(/[^0-9]/g, '')}`}
                    className="mt-3 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" /> {t('business.call')} {desk.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Facility Filters and GPS Locator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filterType === 'ALL'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('emergency.all_emergency_hubs')}
            </button>
            <button
              onClick={() => setFilterType('TRAUMA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filterType === 'TRAUMA'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('emergency.trauma_centers')}
            </button>
            <button
              onClick={() => setFilterType('BLOOD_BANK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                filterType === 'BLOOD_BANK'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Droplets className="h-3.5 w-3.5" />
              {t('emergency.blood_banks')}
            </button>
          </div>

          <button
            onClick={locateMe}
            disabled={gpsLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-colors disabled:opacity-60 shrink-0"
          >
            <MapPin className="h-3.5 w-3.5" />
            {gpsLoading ? t('emergency.detecting_gps') : t('emergency.find_nearest')}
          </button>
        </div>

        {/* Facilities List */}
        <div>
          <h2 className="font-bold text-gray-800 text-sm mb-3">
            {t('emergency.hospitals_near')} {selectedArea || 'Your Location'} ({facilities.length})
          </h2>

          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : facilities.length === 0 ? (
            <EmptyState title={t('emergency.no_facilities')} description={t('emergency.no_facilities_desc')} />
          ) : (
            <div className="space-y-3">
              {facilities.map(f => (
                <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:border-red-200 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 text-sm">{f.name}</h3>
                        {f.is_24_7 && (
                          <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">
                            {t('emergency.casualty_24_7')}
                          </span>
                        )}
                        {f.blood_bank_available && (
                          <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <Droplets className="h-3 w-3" /> {t('emergency.blood_bank')}
                          </span>
                        )}
                        {f.trauma_level && (
                          <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                            Level {f.trauma_level}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-brand-500 shrink-0" />
                        {f.address ?? f.locality}, {f.city}
                      </p>
                      {f.facility_type && <p className="text-xs text-gray-400 mt-0.5">{f.facility_type}</p>}
                    </div>

                    {f.distance_km !== undefined && (
                      <span className="flex-shrink-0 text-xs font-black text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg">
                        {formatDistance(f.distance_km)}
                      </span>
                    )}
                  </div>

                  {f.phone && (
                    <div className="flex gap-2 mt-3 pt-2 border-t border-gray-50">
                      <a
                        href={`tel:${f.phone.replace(/[^0-9]/g, '')}`}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" /> {t('business.call')} {f.phone}
                      </a>
                      {f.secondary_phone && (
                        <a
                          href={`tel:${f.secondary_phone.replace(/[^0-9]/g, '')}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" /> Alt: {f.secondary_phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

