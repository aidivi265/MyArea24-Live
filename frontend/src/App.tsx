import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AuthModal } from '@/components/shared/AuthModal'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { PageSkeleton } from '@/components/shared/Skeleton'
import { useAuthStore } from '@/store'
import { authApi } from '@/services/apiService'

// Lazy-loaded pages
const HomePage = lazy(() => import('@/pages/HomePage'))
const BusinessesPage = lazy(() => import('@/pages/marketplace/BusinessesPage'))
const BusinessStorefrontPage = lazy(() => import('@/pages/marketplace/BusinessStorefrontPage'))
const ProductsPage = lazy(() => import('@/pages/marketplace/ProductsPage'))
const ProductDetailPage = lazy(() => import('@/pages/marketplace/ProductDetailPage'))
const ServicesPage = lazy(() => import('@/pages/marketplace/ServicesPage'))
const OffersPage = lazy(() => import('@/pages/marketplace/OffersPage'))
const EventsPage = lazy(() => import('@/pages/civic/EventsPage'))
const EmergencyPage = lazy(() => import('@/pages/civic/EmergencyPage'))
const MarketPage = lazy(() => import('@/pages/civic/MarketPage'))
const BulletinsPage = lazy(() => import('@/pages/civic/BulletinsPage'))
const MapPage = lazy(() => import('@/pages/map/MapPage'))
const IntelligencePage = lazy(() => import('@/pages/intelligence/IntelligencePage'))
const WeatherPage = lazy(() => import('@/pages/intelligence/WeatherPage'))
const AirQualityPage = lazy(() => import('@/pages/intelligence/AirQualityPage'))
const TrafficPage = lazy(() => import('@/pages/intelligence/TrafficPage'))
const AlertsPage = lazy(() => import('@/pages/intelligence/AlertsPage'))
const AssistantPage = lazy(() => import('@/pages/intelligence/AssistantPage'))
const RouteRiskPage = lazy(() => import('@/pages/intelligence/RouteRiskPage'))
const DemandIntelligencePage = lazy(() => import('@/pages/intelligence/DemandIntelligencePage'))
const CommunitySignalsPage = lazy(() => import('@/pages/intelligence/CommunitySignalsPage'))
const InsightDetailPage = lazy(() => import('@/pages/intelligence/InsightDetailPage'))
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'))
const SavedPage = lazy(() => import('@/pages/profile/SavedPage'))
const MerchantPage = lazy(() => import('@/pages/merchant/MerchantPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))
const OfflinePage = lazy(() => import('@/pages/Offline'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, openAuthModal } = useAuthStore()
  useEffect(() => { if (!isAuthenticated) openAuthModal() }, [isAuthenticated, openAuthModal])
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { token, setUser, logout } = useAuthStore()

  // Rehydrate auth on app load
  useEffect(() => {
    if (!token) return
    authApi.me()
      .then(user => setUser(user))
      .catch(() => logout())
  }, [token, setUser, logout])

  // Listen for auth expiry
  useEffect(() => {
    const handler = () => logout()
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [logout])

  return (
    <>
      <AuthModal />
      <OfflineBanner />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Suspense fallback={<PageSkeleton />}><HomePage /></Suspense>} />

          {/* Marketplace */}
          <Route path="/businesses" element={<Suspense fallback={<PageSkeleton />}><BusinessesPage /></Suspense>} />
          <Route path="/businesses/:slug" element={<Suspense fallback={<PageSkeleton />}><BusinessStorefrontPage /></Suspense>} />
          <Route path="/products" element={<Suspense fallback={<PageSkeleton />}><ProductsPage /></Suspense>} />
          <Route path="/products/:id" element={<Suspense fallback={<PageSkeleton />}><ProductDetailPage /></Suspense>} />
          <Route path="/services" element={<Suspense fallback={<PageSkeleton />}><ServicesPage /></Suspense>} />
          <Route path="/offers" element={<Suspense fallback={<PageSkeleton />}><OffersPage /></Suspense>} />

          {/* Civic */}
          <Route path="/events" element={<Suspense fallback={<PageSkeleton />}><EventsPage /></Suspense>} />
          <Route path="/emergency" element={<Suspense fallback={<PageSkeleton />}><EmergencyPage /></Suspense>} />
          <Route path="/market" element={<Suspense fallback={<PageSkeleton />}><MarketPage /></Suspense>} />
          <Route path="/bulletins" element={<Suspense fallback={<PageSkeleton />}><BulletinsPage /></Suspense>} />

          {/* Map */}
          <Route path="/map" element={<Suspense fallback={<PageSkeleton />}><MapPage /></Suspense>} />

          {/* Intelligence */}
          <Route path="/intelligence" element={<Suspense fallback={<PageSkeleton />}><IntelligencePage /></Suspense>} />
          <Route path="/intelligence/weather" element={<Suspense fallback={<PageSkeleton />}><WeatherPage /></Suspense>} />
          <Route path="/intelligence/air-quality" element={<Suspense fallback={<PageSkeleton />}><AirQualityPage /></Suspense>} />
          <Route path="/intelligence/traffic" element={<Suspense fallback={<PageSkeleton />}><TrafficPage /></Suspense>} />
          <Route path="/intelligence/alerts" element={<Suspense fallback={<PageSkeleton />}><AlertsPage /></Suspense>} />
          <Route path="/intelligence/assistant" element={<Suspense fallback={<PageSkeleton />}><AssistantPage /></Suspense>} />
          <Route path="/intelligence/routes" element={<Suspense fallback={<PageSkeleton />}><RouteRiskPage /></Suspense>} />
          <Route path="/intelligence/demand" element={<Suspense fallback={<PageSkeleton />}><DemandIntelligencePage /></Suspense>} />
          <Route path="/intelligence/community" element={<Suspense fallback={<PageSkeleton />}><CommunitySignalsPage /></Suspense>} />
          {/* /:id must come after all named /intelligence/* routes */}
          <Route path="/intelligence/:id" element={<Suspense fallback={<PageSkeleton />}><InsightDetailPage /></Suspense>} />

          {/* User & Auth Pages */}
          <Route path="/saved" element={<Suspense fallback={<PageSkeleton />}><SavedPage /></Suspense>} />
          <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><ProfilePage /></Suspense></ProtectedRoute>} />
          <Route path="/merchant" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><MerchantPage /></Suspense></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><AdminPage /></Suspense></ProtectedRoute>} />
          <Route path="/offline" element={<Suspense fallback={<PageSkeleton />}><OfflinePage /></Suspense>} />

          {/* Aliases for direct URLs */}
          <Route path="/weather" element={<Navigate to="/intelligence/weather" replace />} />
          <Route path="/air-quality" element={<Navigate to="/intelligence/air-quality" replace />} />
          <Route path="/traffic" element={<Navigate to="/intelligence/traffic" replace />} />
          <Route path="/alerts" element={<Navigate to="/intelligence/alerts" replace />} />
          <Route path="/assistant" element={<Navigate to="/intelligence/assistant" replace />} />
          <Route path="/routes" element={<Navigate to="/intelligence/routes" replace />} />
          <Route path="/demand" element={<Navigate to="/intelligence/demand" replace />} />
          <Route path="/community" element={<Navigate to="/intelligence/community" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}
