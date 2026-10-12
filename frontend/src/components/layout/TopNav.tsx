import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, Bell, LogIn, User, LogOut, Store, ShieldCheck, Bookmark, Languages, Heart } from 'lucide-react'
import { useAuthStore, useUIStore } from '@/store'
import { useSavedStore } from '@/store/savedStore'
import { LocalitySelector } from './LocalitySelector'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'

function LanguageToggle() {
  const { i18n } = useTranslation()
  const { language, setLanguage } = useUIStore()
  const toggleLang = () => {
    const next = language === 'en' ? 'hi' : 'en'
    setLanguage(next)
    i18n.changeLanguage(next)
    document.documentElement.lang = next
  }
  return (
    <button onClick={toggleLang} title="Switch language"
      className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-brand-500 transition-colors px-2 py-1 rounded-lg hover:bg-brand-50">
      <Languages className="h-4 w-4" />
      {language === 'en' ? 'हिंदी' : 'EN'}
    </button>
  )
}

export function TopNav() {
  const { t } = useTranslation()
  const { isAuthenticated, user, logout, openAuthModal, activeMode, setActiveMode } = useAuthStore()
  const { toggleSidebar } = useUIStore()
  const savedCount = useSavedStore((state) => Object.keys(state.items).length)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const isMerchant = user?.role === 'merchant' || (user?.businesses && user.businesses.length > 0)

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
        {/* Hamburger */}
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors md:hidden flex-shrink-0" title="Open Navigation Menu">
          <Menu className="h-5 w-5 text-gray-600" />
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div className="h-8 w-8 rounded-xl bg-brand-500 flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-sm">M</span>
          </div>
          <span className="font-bold text-brand-700 text-base sm:text-lg hidden xs:block sm:block">MyArea<span className="text-gold-400">24</span></span>
        </Link>

        {/* Locality */}
        <div className="flex-1 flex justify-center md:justify-start md:ml-4 min-w-0">
          <LocalitySelector />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isAuthenticated && isMerchant && (
            <button
              onClick={() => {
                if (activeMode === 'merchant') {
                  setActiveMode('resident')
                  navigate('/')
                } else {
                  setActiveMode('merchant')
                  navigate('/merchant')
                }
              }}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all border shadow-xs ${
                activeMode === 'merchant'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
              }`}
              title="Toggle between Resident and Merchant mode"
            >
              <Store className="h-3.5 w-3.5 text-amber-600" />
              <span className="hidden sm:inline">{activeMode === 'merchant' ? '🏪 Merchant Portal' : '🛍️ Resident Mode'}</span>
              <span className="sm:hidden">{activeMode === 'merchant' ? 'Store' : 'Shop'}</span>
            </button>
          )}

          <LanguageToggle />

          <Link to="/saved" className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center" title="Saved Items & Bookmarks">
            <Heart className="h-5 w-5 text-gray-600 hover:text-rose-500 transition-colors" />
            {savedCount > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {savedCount}
              </span>
            )}
          </Link>

          <Link to="/intelligence/alerts" className="p-2 rounded-lg hover:bg-gray-100 transition-colors hidden sm:flex">
            <Bell className="h-5 w-5 text-gray-600" />
          </Link>

          {isAuthenticated ? (
            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-brand-50 hover:bg-brand-100 transition-colors text-brand-700">
                <div className="h-6 w-6 rounded-full bg-brand-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}</span>
                </div>
                <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">{user?.full_name ?? user?.email}</span>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                      <p className="font-semibold text-sm text-gray-800 truncate">{user?.full_name ?? 'User'}</p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>

                    {/* Merchant Switcher or Register Banner inside Dropdown */}
                    {isMerchant ? (
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          if (activeMode === 'merchant') {
                            setActiveMode('resident')
                            navigate('/')
                          } else {
                            setActiveMode('merchant')
                            navigate('/merchant')
                          }
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors border-b border-amber-100"
                      >
                        <span className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-amber-600" />
                          {activeMode === 'merchant' ? 'Switch to Resident' : 'Switch to Merchant'}
                        </span>
                        <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">Toggle</span>
                      </button>
                    ) : (
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors border-b border-amber-100"
                      >
                        <Store className="h-4 w-4 text-amber-600" />
                        <span>Register as Merchant</span>
                      </Link>
                    )}

                    {[
                      { to: '/profile', icon: <User className="h-4 w-4" />, label: t('nav.profile') },
                      { to: '/saved', icon: <Bookmark className="h-4 w-4" />, label: t('nav.saved') },
                      ...(isMerchant ? [{ to: '/merchant', icon: <Store className="h-4 w-4" />, label: t('nav.merchant', { defaultValue: 'Merchant Dashboard' }) }] : []),
                      ...(user?.role === 'admin' ? [{ to: '/admin', icon: <ShieldCheck className="h-4 w-4" />, label: t('nav.admin') }] : []),
                    ].map(item => (
                      <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-gray-700">
                        {item.icon}{item.label}
                      </Link>
                    ))}
                    <button onClick={() => { logout(); setMenuOpen(false); navigate('/') }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 transition-colors border-t border-gray-100">
                      <LogOut className="h-4 w-4" />{t('nav.logout')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button onClick={openAuthModal}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs sm:text-sm font-medium transition-colors shadow-sm">
              <LogIn className="h-4 w-4" /><span>{t('nav.login')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
