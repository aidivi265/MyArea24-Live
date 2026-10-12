import { useState, useEffect } from 'react'
import { WifiOff, PhoneCall, CheckCircle, X } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [justReconnected, setJustReconnected] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      setJustReconnected(true)
      setDismissed(false)
      const timer = setTimeout(() => {
        setJustReconnected(false)
      }, 3500)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOffline(true)
      setJustReconnected(false)
      setDismissed(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (justReconnected) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed top-16 left-0 right-0 z-50 bg-emerald-600 text-white px-4 py-2 shadow-lg flex items-center justify-between text-sm font-medium transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-200" />
            <span>Connection restored. Syncing real-time district data...</span>
          </div>
          <button
            onClick={() => setJustReconnected(false)}
            aria-label="Dismiss connection restored notification"
            className="p-1 hover:bg-emerald-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    )
  }

  if (!isOffline || dismissed) return null

  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-amber-950/95 border border-amber-600/60 backdrop-blur-md text-amber-100 p-3.5 rounded-xl shadow-2xl flex flex-col gap-2.5 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
          <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-400" />
          <span>Offline Mode Active</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss offline banner"
          className="text-amber-400 hover:text-white p-0.5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-amber-200/90 leading-relaxed">
        Network connection unavailable. Offline cache is serving stored directory and alerts. Emergency hotlines remain reachable directly:
      </p>

      <div className="flex items-center gap-2 pt-1 border-t border-amber-800/50">
        <a
          href="tel:112"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>112 All-India</span>
        </a>
        <a
          href="tel:108"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>108 Medical</span>
        </a>
        <a
          href="tel:1033"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>1033 Highway</span>
        </a>
      </div>
    </aside>
  )
}
