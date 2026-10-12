import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Home, Building2, Package, Wrench, Tag, CalendarDays,
  Zap, Cloud, Wind, Car, AlertTriangle, Map, Heart,
  TrendingUp, Fuel, Newspaper, ShieldAlert, X, Bot,
  Navigation, Radio, Languages,
} from 'lucide-react'
import { useUIStore } from '@/store'
import { useSavedStore } from '@/store/savedStore'
import { motion, AnimatePresence } from 'framer-motion'

const sections = [
  {
    title: 'Marketplace',
    items: [
      { to: '/', icon: Home, key: 'home' },
      { to: '/businesses', icon: Building2, key: 'businesses' },
      { to: '/products', icon: Package, key: 'products' },
      { to: '/services', icon: Wrench, key: 'services' },
      { to: '/offers', icon: Tag, key: 'offers' },
      { to: '/events', icon: CalendarDays, key: 'events' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { to: '/intelligence', icon: Zap, key: 'intelligence' },
      { to: '/intelligence/routes', icon: Navigation, key: 'routes', label: 'Route Intelligence' },
      { to: '/intelligence/demand', icon: TrendingUp, key: 'demand', label: 'Demand Surges' },
      { to: '/intelligence/weather', icon: Cloud, key: 'weather', label: 'Weather' },
      { to: '/intelligence/air-quality', icon: Wind, key: 'aqi', label: 'Air Quality' },
      { to: '/intelligence/traffic', icon: Car, key: 'traffic', label: 'Traffic' },
      { to: '/intelligence/alerts', icon: AlertTriangle, key: 'alerts' },
      { to: '/intelligence/assistant', icon: Bot, key: 'assistant', label: 'AI Saathi (साथी)' },
    ],
  },
  {
    title: 'Community',
    items: [
      { to: '/intelligence/community', icon: Radio, key: 'community', label: 'Live Ground Truth' },
      { to: '/map', icon: Map, key: 'map' },
      { to: '/emergency', icon: ShieldAlert, key: 'emergency' },
      { to: '/market', icon: TrendingUp, key: 'market' },
      { to: '/market#fuel', icon: Fuel, key: 'fuel', label: 'Fuel Rates' },
      { to: '/bulletins', icon: Newspaper, key: 'bulletins', label: 'Bulletins' },
      { to: '/saved', icon: Heart, key: 'saved' },
    ],
  },
]

export function Sidebar() {
  const { t, i18n } = useTranslation()
  const { sidebarOpen, closeSidebar, language, setLanguage } = useUIStore()
  const savedCount = useSavedStore((state) => Object.keys(state.items).length)

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-black text-sm">M</span>
          </div>
          <span className="font-bold text-brand-700 text-lg">MyArea<span className="text-gold-400">24</span></span>
        </div>
        <button onClick={closeSidebar} className="md:hidden p-1.5 rounded-lg hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-5">
        {sections.map(section => (
          <div key={section.title}>
            <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{section.title}</p>
            {section.items.map(({ to, icon: Icon, key, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{label ?? t(`nav.${key}`, { defaultValue: label ?? key })}</span>
                {key === 'saved' && savedCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    {savedCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between text-xs mt-auto">
        <span className="font-semibold text-gray-500 flex items-center gap-1.5">
          <Languages className="h-4 w-4 text-brand-500" />
          {language === 'en' ? 'Language' : 'भाषा'}
        </span>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5 shadow-2xs">
          <button
            onClick={() => {
              setLanguage('en')
              i18n.changeLanguage('en')
              document.documentElement.lang = 'en'
            }}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
              language === 'en' ? 'bg-brand-500 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            English
          </button>
          <button
            onClick={() => {
              setLanguage('hi')
              i18n.changeLanguage('hi')
              document.documentElement.lang = 'hi'
            }}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
              language === 'hi' ? 'bg-brand-500 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 fixed left-0 top-14 bottom-0 border-r border-gray-100 overflow-y-auto z-30">
        {sidebarContent}
      </aside>

      {/* Mobile sheet */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={closeSidebar} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 md:hidden shadow-xl">
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
