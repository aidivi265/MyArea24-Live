import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { AmbientSyncBar } from '@/components/shared/AmbientSyncBar'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { useLocationStore } from '@/store'
import { locationApi } from '@/services/apiService'
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function GPSBootstrap() {
  const { setLocation } = useLocationStore()
  const { t } = useTranslation()
  const [detecting, setDetecting] = useState(false)
  const [detectedCity, setDetectedCity] = useState<string | null>(null)

  useEffect(() => {
    // Check if user has explicitly chosen a location or auto-detection already ran
    const manuallySet = localStorage.getItem('ma24_location_manually_set') === 'true'
    const alreadyAttempted = sessionStorage.getItem('ma24_gps_auto_attempted') === 'true'

    if (manuallySet || alreadyAttempted) {
      return
    }

    if (!navigator.geolocation) {
      return
    }

    sessionStorage.setItem('ma24_gps_auto_attempted', 'true')
    setDetecting(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await locationApi.detect(pos.coords.latitude, pos.coords.longitude)
          const city = result.town || result.district || result.display_label.split(',')[0].trim()
          setLocation(result.display_label, result.latitude, result.longitude, {
            city,
            state: result.state,
            district: result.district,
            village: result.village,
            tehsil: result.tehsil,
            pincode: result.pincode,
            accuracy: result.accuracy,
            rawAddress: result.display_label,
          })
          setDetectedCity(city || result.display_label.split(',')[0].trim())
          setTimeout(() => setDetectedCity(null), 3500)
        } catch {
          // fallback: use coordinates directly
          setLocation(
            `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
            pos.coords.latitude,
            pos.coords.longitude
          )
        } finally {
          setDetecting(false)
        }
      },
      (_err) => {
        setDetecting(false)
      },
      { timeout: 9000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: true }
    )
  }, [setLocation])

  if (detectedCity) {
    return (
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold shadow-xl animate-fade-in">
        <CheckCircle2 className="h-4 w-4" />
        <span>📍 {detectedCity}</span>
      </div>
    )
  }

  if (!detecting) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-xs sm:text-sm font-medium shadow-xl animate-bounce-once">
      <Loader2 className="h-4 w-4 animate-spin" />
      <MapPin className="h-4 w-4" />
      <span>{t('home.detecting_location', { defaultValue: 'Detecting your location…' })}</span>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <div>
        <GPSBootstrap />
        <TopNav />
        <Sidebar />
        <main className="pt-14 pb-20 md:pb-6 md:pl-56 min-h-[calc(100vh-80px)]">
          <div className="max-w-6xl mx-auto px-3.5 sm:px-4 py-3.5 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <div className="md:pl-56 pb-16 md:pb-0">
        <AmbientSyncBar />
      </div>
      <ScrollToTop />
      <BottomNav />
    </div>
  )
}
