import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Compass, Map, Bell, User, Store } from 'lucide-react'
import { useAuthStore } from '@/store'
import { useSavedStore } from '@/store/savedStore'

export function BottomNav() {
  const { t } = useTranslation()
  const { user, isAuthenticated, activeMode } = useAuthStore()
  const savedCount = useSavedStore((state) => Object.keys(state.items).length)

  const isMerchant = user?.role === 'merchant' || (user?.businesses && user.businesses.length > 0)

  const tabs = [
    { to: '/', icon: Home, label: t('nav.home', { defaultValue: 'Home' }) },
    { to: '/businesses', icon: Compass, label: t('nav.explore', { defaultValue: 'Explore' }) },
    { to: '/map', icon: Map, label: t('nav.map', { defaultValue: 'Live Map' }) },
    { to: '/intelligence/alerts', icon: Bell, label: t('nav.alerts', { defaultValue: 'Alerts' }) },
    {
      to: '/profile',
      icon: isMerchant && activeMode === 'merchant' ? Store : User,
      label: isMerchant ? (activeMode === 'merchant' ? 'Store' : 'Profile') : t('nav.profile', { defaultValue: 'Profile' }),
      badge: isMerchant ? '🏪' : null,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-area-pb">
      <div className="flex justify-around items-center h-16 px-1.5 max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-200 select-none ${
                isActive
                  ? 'text-brand-600 font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`relative p-1.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-50 text-brand-600 scale-105 shadow-sm'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {badge && (
                    <span className="absolute -top-1 -right-1 text-[10px] leading-none">
                      {badge}
                    </span>
                  )}
                  {to === '/intelligence/alerts' && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </div>
                <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'font-bold' : ''}`}>
                  {label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0.5 h-1 w-6 rounded-full bg-brand-500" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
