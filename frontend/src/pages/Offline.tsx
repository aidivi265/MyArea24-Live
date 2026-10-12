import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WifiOff, RefreshCw, PhoneCall, ShieldAlert, MapPin, Compass } from 'lucide-react'
import { SEOMeta } from '@/components/shared/SEOMeta'

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', handleStatus)
    window.addEventListener('offline', handleStatus)
    return () => {
      window.removeEventListener('online', handleStatus)
      window.removeEventListener('offline', handleStatus)
    }
  }, [])

  const handleRetry = () => {
    setIsChecking(true)
    setTimeout(() => {
      setIsChecking(false)
      if (navigator.onLine) {
        window.location.href = '/'
      }
    }, 800)
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <SEOMeta
        title="Offline Mode — MyArea24"
        description="You are currently offline. Access cached local intelligence and offline emergency hotlines."
        canonical="https://myarea24.in/offline"
      />

      <div className="max-w-xl w-full bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <WifiOff className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {isOnline ? 'Network Restored' : 'You are Currently Offline'}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isOnline
              ? 'Your internet connection is active again. Tap retry to sync live district intelligence.'
              : 'Network connectivity is temporarily lost. Your PWA service worker is serving cached data across 780+ districts, and emergency hotlines remain active.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking Connection...' : 'Check & Reconnect'}</span>
          </button>
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors"
          >
            <Compass className="w-4 h-4" />
            <span>Explore Cached Data</span>
          </Link>
        </div>

        {/* Offline Emergency Quick Action Grid */}
        <div className="pt-6 border-t border-border text-left space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <span>Zero-Data Emergency Speed-Dials (Works without Internet)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href="tel:112"
              className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors group"
            >
              <div>
                <div className="text-sm font-bold text-red-700 dark:text-red-400">112 National Police / SOS</div>
                <div className="text-xs text-muted-foreground">Unified All-India Response</div>
              </div>
              <PhoneCall className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
            </a>

            <a
              href="tel:108"
              className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors group"
            >
              <div>
                <div className="text-sm font-bold text-blue-700 dark:text-blue-400">108 Medical Ambulance</div>
                <div className="text-xs text-muted-foreground">Emergency Healthcare Response</div>
              </div>
              <PhoneCall className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            </a>

            <a
              href="tel:1033"
              className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors group"
            >
              <div>
                <div className="text-sm font-bold text-amber-700 dark:text-amber-400">1033 NHAI Expressway SOS</div>
                <div className="text-xs text-muted-foreground">National Highway Assistance</div>
              </div>
              <PhoneCall className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
            </a>

            <a
              href="tel:1078"
              className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors group"
            >
              <div>
                <div className="text-sm font-bold text-purple-700 dark:text-purple-400">1078 NDMA Disaster Desk</div>
                <div className="text-xs text-muted-foreground">Flood, Cyclone & Quake Control</div>
              </div>
              <PhoneCall className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>

        {/* Offline Features Info */}
        <div className="pt-2 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span>MyArea24 local service worker maintains cached offline directory</span>
        </div>
      </div>
    </div>
  )
}
