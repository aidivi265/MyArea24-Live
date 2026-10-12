import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import hi from './hi.json'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: localStorage.getItem('ma24-ui') ? JSON.parse(localStorage.getItem('ma24-ui')!).state?.language || 'en' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
