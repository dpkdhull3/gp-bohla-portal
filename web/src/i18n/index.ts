import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import hi from './locales/hi.json'
import en from './locales/en.json'

void i18n.use(initReactI18next).init({
  resources: {
    hi: { translation: hi },
    en: { translation: en },
  },
  lng: 'hi',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
