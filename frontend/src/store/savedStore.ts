import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { savedApi } from '@/services/apiService'
import { useAuthStore } from './index'
import type { SaveItemType } from '@/types'

export interface SavedRecord {
  type: SaveItemType
  id: number
  data: any
  savedAt: string
}

interface SavedStoreState {
  items: Record<string, SavedRecord>
  isSaved: (type: SaveItemType, id: number) => boolean
  toggleSave: (type: SaveItemType, id: number, data?: any) => Promise<boolean>
  removeItem: (type: SaveItemType, id: number) => Promise<void>
  clearAll: () => Promise<void>
  syncWithBackend: () => Promise<void>
  hydrateFromApi: (apiData: any) => void
}

const makeKey = (type: SaveItemType, id: number) => `${type}_${id}`

export const useSavedStore = create<SavedStoreState>()(
  persist(
    (set, get) => ({
      items: {},

      isSaved: (type, id) => {
        return !!get().items[makeKey(type, id)]
      },

      toggleSave: async (type, id, data) => {
        const key = makeKey(type, id)
        const currentlySaved = !!get().items[key]
        const isAuthenticated = useAuthStore.getState().isAuthenticated

        if (currentlySaved) {
          // Remove optimistically
          set((state) => {
            const next = { ...state.items }
            delete next[key]
            return { items: next }
          })

          if (isAuthenticated) {
            try {
              await savedApi.remove(type, id)
            } catch (err) {
              console.warn('[SavedStore] Backend remove failed:', err)
            }
          }
          return false
        } else {
          // Add optimistically
          const record: SavedRecord = {
            type,
            id,
            data: data || {},
            savedAt: new Date().toISOString(),
          }

          set((state) => ({
            items: {
              ...state.items,
              [key]: record,
            },
          }))

          if (isAuthenticated) {
            try {
              await savedApi.toggle(type, id)
            } catch (err) {
              console.warn('[SavedStore] Backend toggle failed:', err)
            }
          }
          return true
        }
      },

      removeItem: async (type, id) => {
        const key = makeKey(type, id)
        const isAuthenticated = useAuthStore.getState().isAuthenticated

        set((state) => {
          const next = { ...state.items }
          delete next[key]
          return { items: next }
        })

        if (isAuthenticated) {
          try {
            await savedApi.remove(type, id)
          } catch (err) {
            console.warn('[SavedStore] Backend remove failed:', err)
          }
        }
      },

      clearAll: async () => {
        const isAuthenticated = useAuthStore.getState().isAuthenticated
        set({ items: {} })

        if (isAuthenticated) {
          try {
            await savedApi.clearAll()
          } catch (err) {
            console.warn('[SavedStore] Backend clear all failed:', err)
          }
        }
      },

      syncWithBackend: async () => {
        const isAuthenticated = useAuthStore.getState().isAuthenticated
        if (!isAuthenticated) return

        const currentItems = Object.values(get().items)
        if (currentItems.length > 0) {
          try {
            await savedApi.sync(
              currentItems.map((i) => ({
                item_type: i.type,
                item_id: i.id,
              }))
            )
          } catch (err) {
            console.warn('[SavedStore] Sync to backend failed:', err)
          }
        }
      },

      hydrateFromApi: (apiData) => {
        if (!apiData) return
        const next = { ...get().items }

        const addList = (list: any[] | undefined, type: SaveItemType) => {
          if (!list || !Array.isArray(list)) return
          for (const item of list) {
            if (item && item.id) {
              const k = makeKey(type, item.id)
              next[k] = {
                type,
                id: item.id,
                data: { ...(next[k]?.data || {}), ...item },
                savedAt: next[k]?.savedAt || item.saved_at || new Date().toISOString(),
              }
            }
          }
        }

        addList(apiData.businesses, 'business')
        addList(apiData.products, 'product')
        addList(apiData.services, 'service')
        addList(apiData.offers, 'offer')
        addList(apiData.bulletins, 'bulletin')
        addList(apiData.events, 'event')

        set({ items: next })
      },
    }),
    {
      name: 'ma24-saved-store',
      partialize: (s) => ({ items: s.items }),
    }
  )
)
