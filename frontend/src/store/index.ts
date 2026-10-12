import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  authModalOpen: boolean
  activeMode: 'resident' | 'merchant'
  setActiveMode: (mode: 'resident' | 'merchant') => void
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
  openAuthModal: () => void
  closeAuthModal: () => void
}

export interface ExactAddressDetails {
  area?: string
  lat?: number
  lon?: number
  city?: string
  state?: string
  district?: string
  village?: string
  tehsil?: string
  pincode?: string
  accuracy?: string
  rawAddress?: string
}

interface LocationState {
  selectedArea: string
  selectedLat: number | null
  selectedLon: number | null
  selectedCity?: string
  selectedState?: string
  selectedDistrict?: string
  selectedVillage?: string
  selectedTehsil?: string
  selectedPincode?: string
  selectedAccuracy?: string
  selectedRawAddress?: string
  setLocation: (
    area: string,
    lat: number,
    lon: number,
    cityOrDetails?: string | ExactAddressDetails,
    state?: string,
    district?: string,
    pincode?: string
  ) => void
  setExactAddress: (details: ExactAddressDetails) => void
}

interface UIState {
  language: 'en' | 'hi'
  sidebarOpen: boolean
  setLanguage: (lang: 'en' | 'hi') => void
  toggleSidebar: () => void
  closeSidebar: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      authModalOpen: false,
      activeMode: 'resident',
      setActiveMode: (mode) => set({ activeMode: mode }),
      login: (token, user) => {
        localStorage.setItem('ma24_token', token)
        set({ token, user, isAuthenticated: true, authModalOpen: false })
      },
      logout: () => {
        localStorage.removeItem('ma24_token')
        set({ token: null, user: null, isAuthenticated: false, activeMode: 'resident' })
      },
      setUser: (user) => set({ user }),
      openAuthModal: () => set({ authModalOpen: true }),
      closeAuthModal: () => set({ authModalOpen: false }),
    }),
    { name: 'ma24-auth', partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated, activeMode: s.activeMode }) }
  )
)

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      selectedArea: 'Delhi Connaught Place',
      selectedLat: 28.6304,
      selectedLon: 77.2177,
      selectedCity: 'Delhi',
      selectedState: 'Delhi NCR',
      selectedDistrict: 'Central Delhi',
      selectedVillage: '',
      selectedTehsil: 'New Delhi',
      selectedPincode: '110001',
      selectedAccuracy: 'exact',
      selectedRawAddress: 'Connaught Place, Central Delhi, Delhi NCR, 110001',
      setLocation: (area, lat, lon, cityOrDetails, state, district, pincode) => {
        if (typeof cityOrDetails === 'object' && cityOrDetails !== null) {
          set({
            selectedArea: area,
            selectedLat: lat,
            selectedLon: lon,
            selectedCity: cityOrDetails.city,
            selectedState: cityOrDetails.state,
            selectedDistrict: cityOrDetails.district,
            selectedVillage: cityOrDetails.village || '',
            selectedTehsil: cityOrDetails.tehsil || '',
            selectedPincode: cityOrDetails.pincode || '',
            selectedAccuracy: cityOrDetails.accuracy || 'exact',
            selectedRawAddress: cityOrDetails.rawAddress || area,
          })
        } else {
          set({
            selectedArea: area,
            selectedLat: lat,
            selectedLon: lon,
            selectedCity: cityOrDetails,
            selectedState: state,
            selectedDistrict: district,
            selectedPincode: pincode,
            selectedRawAddress: area,
          })
        }
      },
      setExactAddress: (details) => {
        set({
          selectedArea: details.area || details.rawAddress || 'Selected Location',
          selectedLat: details.lat ?? null,
          selectedLon: details.lon ?? null,
          selectedCity: details.city,
          selectedState: details.state,
          selectedDistrict: details.district,
          selectedVillage: details.village || '',
          selectedTehsil: details.tehsil || '',
          selectedPincode: details.pincode || '',
          selectedAccuracy: details.accuracy || 'exact',
          selectedRawAddress: details.rawAddress || details.area || '',
        })
      },
    }),
    { name: 'ma24-location' }
  )
)

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      language: 'en',
      sidebarOpen: false,
      setLanguage: (lang) => set({ language: lang }),
      toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),
    }),
    { name: 'ma24-ui', partialize: (s) => ({ language: s.language }) }
  )
)

export { useSavedStore } from './savedStore'

